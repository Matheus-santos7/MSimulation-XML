/**
 * Sale return NF-e (DEVOLUÇÃO) emission referencing the original sale.
 *
 * Fulfillment chain:
 *   SHIPMENT → SYMBOLIC RETURN → SALE → RETURN
 *
 * The return:
 *  - references the original sale NF-e (nfeReferenciaId → sale);
 *  - mirrors sale tax math (same rates via engine), proportionally to the
 *    returned quantity of each line (partial returns by `nItem` are allowed
 *    until the sold quantities are exhausted);
 *  - applies the tenant DE/PARA of CST devolução (`cstDevolucao`) per item;
 *  - reverses FIFO balance consumed in the chain back to shipments (only the
 *    returned quantities);
 *  - re-ships the returned lines to the CD via a multi-item symbolic shipment
 *    (CAT 31 §4.2).
 */

import { Injectable } from "@nestjs/common";
import {
  FiscalStatus,
  NFeTipo,
  Prisma,
  type Product,
} from "../../../../generated/prisma/client.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { mapNfe, num } from "../../shared/fiscal-document.mapper.js";
import { buildChaveNFe } from "../../nfe/rules/nfe-chave.js";
import { proximoNumeroNfe } from "../../nfe/rules/nfe-sequencia.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/index.js";
import {
  enrichFiscalPayloadWithXTexto,
  resolveNumeroInicialNfe,
} from "@msimulation-xml/fiscal-core";
import { taxSnapshotFromRule } from "../../../tax/index.js";
import { calcularNotaFiscal, type NotaFiscalResult } from "../../../tax/index.js";
import { applyCstDevolucaoMap } from "../../../tax/index.js";
import { mirrorOriginForDevolucao, parseOriginEngine } from "../../../tax/index.js";
import { buildFiscalItem, resolveTaxRule, resolveIcmsFallbackRate } from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../../nfe/xml/nfe-xml.service.js";
import { reverseRemessaFifoConsumptionsForReturn } from "../../../remessas/index.js";
import {
  prepareSymbolicShipmentFiscal,
  SymbolicShipmentFiscalError,
} from "../../../remessas/index.js";
import type {
  ProcessReturnResult,
  ReturnableItemsResult,
} from "../../shared/lifecycle-result.types.js";
import { DocumentReturnError } from "../../errors/fiscal-documents.errors.js";
import {
  computeReturnableLines,
  DevolucaoItensError,
  resolveRequestedReturnLines,
  type RequestedReturnLine,
} from "../rules/devolucao-itens.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import type {
  ProcessReturnInput,
  ReturnableItemsInput,
} from "../../shared/lifecycle-input.types.js";

import {
  type ReturnLine,
  buildFifoReversalLines,
  createReturnItemRows,
  entregaFromOperadorLogistico,
  extractCstFromPayload,
  idCadIntTranFromRemessaFiscalPayload,
  resolveCustomerType,
  resolveDestIeForOperadorLogistico,
  resolveInfIntermedForReturn,
  resolveReturnCfop,
} from "../rules/return-fiscal.rules.js";

/** Linha (`<det>`) da venda com o produto do catálogo resolvido. */
type SaleLine = {
  numeroItem: number;
  product: Product;
  quantidade: number;
  valorUnitario: number;
};

const RETURN_TIPOS = [NFeTipo.DEVOLUCAO, NFeTipo.INSULCESSO_DE_ENTREGA] as const;

const saleForReturnInclude = {
  tenant: true,
  product: true,
  nfeReferencia: true,
  pedido: {
    include: {
      itens: { include: { product: true }, orderBy: { numeroItem: "asc" as const } },
    },
  },
} satisfies Prisma.NFeInclude;

type SaleForReturn = Prisma.NFeGetPayload<{ include: typeof saleForReturnInclude }>;

type PriorReturnRow = {
  id: string;
  chave: string;
  numero: number;
  serie: number;
  tipo: NFeTipo;
  quantidade: number;
  itens: Array<{ productId: string; quantidade: number }>;
};

@Injectable()
export class SaleReturnUseCase {
  private get db() {
    return getDbClient();
  }

  async execute(input: ProcessReturnInput): Promise<ProcessReturnResult> {
    const { tenantId, saleNfeKey } = input;
    const returnTipo = input.returnTipo ?? NFeTipo.DEVOLUCAO;
    const natOp =
      returnTipo === NFeTipo.INSULCESSO_DE_ENTREGA
        ? "Insucesso de entrega de mercadorias"
        : "Devolucao de mercadorias";

    const sale = await this.loadSaleForReturn(tenantId, saleNfeKey);
    const saleLines = await this.resolveSaleLines(sale);
    const priorReturns = await this.loadPriorReturns(sale.id);
    const returnable = computeReturnableLines(
      saleLines.map((line) => ({
        numeroItem: line.numeroItem,
        productId: line.product.id,
        quantidade: line.quantidade,
      })),
      priorReturns,
    );

    let requested: RequestedReturnLine[];
    try {
      requested = resolveRequestedReturnLines(returnable, input.itens);
    } catch (error) {
      if (error instanceof DevolucaoItensError) {
        const last = priorReturns.at(-1);
        const suffix =
          error.status === 409 && last ? ` Última NF-e: ${last.numero}/${last.serie}.` : "";
        throw new DocumentReturnError(`${error.message}${suffix}`, error.status);
      }
      throw error;
    }

    const returnLines: ReturnLine[] = requested.map((line) => ({
      ...line,
      product: saleLines.find((sl) => sl.numeroItem === line.numeroItem)!.product,
    }));
    const primaryLine = returnLines[0]!;
    const product = primaryLine.product;

    const tenant = sale.tenant;
    const series = tenant.serieRemessa;
    const customerType = resolveCustomerType(sale.destIndIeDest);
    const quantity = returnLines.reduce((sum, line) => sum + line.quantidade, 0);
    const cfop = resolveReturnCfop(tenant.uf, sale.destUf);

    return runFiscalTransaction(this.db, tenantId, async (tx) => {
      const emitterSettings = await loadEmitterSettings(tx, tenant.id, sale.marketplace);

      const saleTaxRule = await resolveTaxRule(tx, tenant.id, {
        originUf: tenant.uf,
        destinationUf: sale.destUf,
        transactionType: "sale",
        customerType,
        ruleBaseId: product.taxRuleBaseId?.trim() || undefined,
      });

      const icmsFallbackRate =
        num(sale.aliqIcms) ||
        resolveIcmsFallbackRate(tenant.uf, sale.destUf, "sale", emitterSettings);
      const referencedSaleCst = extractCstFromPayload(sale.fiscalPayload);
      const saleFiscalPayload = sale.fiscalPayload as Record<string, unknown> | undefined;
      const ufSaidaFisica =
        typeof saleFiscalPayload?.ufSaidaFisica === "string"
          ? saleFiscalPayload.ufSaidaFisica
          : undefined;
      const cMunSaidaFisica =
        typeof saleFiscalPayload?.cMunSaidaFisica === "string"
          ? saleFiscalPayload.cMunSaidaFisica
          : undefined;

      // Regra de ouro: espelhar engine da venda, proporcional à quantidade devolvida de
      // cada linha (MOC finNFe=4 / NT 2016.002). Fallback (venda legada sem engine) =
      // recalcular pela TaxRule com a quantidade devolvida.
      const originEngine = parseOriginEngine(saleFiscalPayload?.engine);
      const invoice: NotaFiscalResult = applyCstDevolucaoMap(
        originEngine
          ? mirrorOriginForDevolucao({
              origin: originEngine,
              itens: returnLines.map((line) => ({
                numeroItem: line.numeroItem,
                quantidade: line.quantidade,
              })),
              nonContributorIpi: customerType === "non_taxpayer",
            })
          : calcularNotaFiscal(
              returnLines.map((line, index) => {
                const saleLine = saleLines.find((sl) => sl.numeroItem === line.numeroItem)!;
                return buildFiscalItem(
                  {
                    codigo: line.product.sku ?? line.product.id,
                    descricao: line.product.nome,
                    ncm: line.product.ncm,
                    cfop,
                    unidade: line.product.unidade ?? "UN",
                    cest: line.product.cest ?? undefined,
                    ean: line.product.ean ?? undefined,
                    exTipi: line.product.exTipi ?? undefined,
                    origem: line.product.origem ?? 0,
                    quantidade: line.quantidade,
                    valorUnitario: saleLine.valorUnitario,
                    numeroItem: index + 1,
                  },
                  saleTaxRule,
                  {
                    ufOrigem: tenant.uf,
                    ufSaidaFisica,
                    ufDestino: sale.destUf,
                    customerType,
                    emitterSettings,
                    operationTipo: "DEVOLUCAO",
                    cstVendaReferencia: referencedSaleCst,
                  },
                  icmsFallbackRate,
                );
              }),
            ),
        emitterSettings.taxes.cstDevolucao,
      );
      if (invoice.itens.length !== returnLines.length) {
        throw new DocumentReturnError(
          "Falha ao espelhar os itens da venda na devolução (linhas divergentes).",
          422,
        );
      }

      const totalValue = invoice.totais.vNF;
      const returnIcmsRate = invoice.itens[0]?.icms.pICMS || icmsFallbackRate;
      const returnIcmsValue = invoice.totais.vICMS;
      const entregaOl = entregaFromOperadorLogistico(sale.nfeReferencia);
      const infIntermed = resolveInfIntermedForReturn(saleFiscalPayload, sale.nfeReferencia);

      const numeroInicial = resolveNumeroInicialNfe(emitterSettings, series, {
        serieRemessa: tenant.serieRemessa,
        serieTransferencia: tenant.serieTransferencia,
      });
      const number = await proximoNumeroNfe(tx, tenant.id, series, numeroInicial);
      const accessKey = buildChaveNFe({
        uf: tenant.uf,
        cnpj: tenant.cnpj,
        serie: series,
        numero: number,
      });

      const taxSnapshot = enrichTaxSnapshot(
        taxSnapshotFromRule(saleTaxRule, icmsFallbackRate, emitterSettings),
        {
          settings: emitterSettings,
          tipo: returnTipo,
          valor: totalValue,
          valorIcms: returnIcmsValue,
          emitUf: tenant.uf,
          destUf: sale.destUf,
          indFinal: customerType === "non_taxpayer" ? 1 : 0,
          cstVendaReferencia: referencedSaleCst,
        },
      );

      const returnRow = await tx.nFe.create({
        data: {
          tenantId: tenant.id,
          marketplace: sale.marketplace,
          productId: product.id,
          chave: accessKey,
          numero: number,
          serie: series,
          natOp,
          cfop,
          ncm: product.ncm,
          destNome: sale.destNome,
          destDoc: sale.destDoc,
          destUf: sale.destUf,
          destLogradouro: sale.destLogradouro,
          destNumero: sale.destNumero,
          destComplemento: sale.destComplemento,
          destBairro: sale.destBairro,
          destCodigoMunicipio: sale.destCodigoMunicipio,
          destMunicipio: sale.destMunicipio,
          destCep: sale.destCep,
          destCodigoPais: sale.destCodigoPais,
          destNomePais: sale.destNomePais,
          destTelefone: sale.destTelefone,
          destIndIeDest: sale.destIndIeDest,
          valor: invoice.totais.vNF,
          valorIcms: returnIcmsValue,
          aliqIcms: returnIcmsRate,
          status: FiscalStatus.AUTORIZADA,
          emitidaEm: new Date(),
          pedidoMl: sale.pedidoMl,
          quantidade: quantity,
          tipo: returnTipo,
          saldoDisponivel: null,
          nfeReferenciaId: sale.id,
          fiscalPayload: enrichFiscalPayloadWithXTexto(
            {
              ...taxSnapshot,
              engine: invoice,
              nfeOrigem: {
                numero: sale.numero,
                serie: sale.serie,
                emitidaEm:
                  sale.emitidaEm instanceof Date
                    ? sale.emitidaEm.toISOString()
                    : String(sale.emitidaEm),
              },
              // Auditoria da devolução parcial: det da devolução ↔ nItem da venda.
              devolucaoItens: returnLines.map((line, index) => ({
                numeroItem: index + 1,
                nItemOrigem: line.numeroItem,
                productId: line.product.id,
                sku: line.product.sku ?? null,
                quantidade: line.quantidade,
              })),
              ...(sale.nfeReferencia
                ? {
                    ufFilialInfCpl: sale.nfeReferencia.destUf,
                    cnpjFilialInfCpl: sale.nfeReferencia.destDoc,
                  }
                : {}),
              ...(ufSaidaFisica ? { ufSaidaFisica } : {}),
              ...(cMunSaidaFisica ? { cMunSaidaFisica } : {}),
              ...(entregaOl ? { entrega: entregaOl } : {}),
              ...(infIntermed ? { infIntermed } : {}),
            } as Record<string, unknown>,
            {
              tipo: returnTipo,
              cfop,
              natOp,
              pedidoMl: sale.pedidoMl,
              indFinal: customerType === "non_taxpayer" ? 1 : 0,
            },
          ) as Prisma.InputJsonValue,
        },
      });

      const returnItemRows = await createReturnItemRows(tx, {
        tenantId: tenant.id,
        nfeId: returnRow.id,
        cfop,
        lines: returnLines,
        engineItems: invoice.itens,
      });

      await persistNfeXmlFromEmission(tx, {
        nfeId: returnRow.id,
        tenant,
        productId: product.id,
        products: returnLines.map((line) => line.product),
        settings: emitterSettings,
        nfeReferenciaChave: sale.chave,
      });

      // Estorno FIFO só das quantidades devolvidas agora; o que devoluções anteriores
      // já creditaram às remessas é pulado (janela por produto sobre os consumos).
      const reversals = sale.nfeReferenciaId
        ? await reverseRemessaFifoConsumptionsForReturn(
            tx,
            sale.nfeReferenciaId,
            await buildFifoReversalLines(tx, tenant.id, returnLines, returnable),
          )
        : [];

      const mainShipment = sale.nfeReferencia?.nfeReferenciaId
        ? await tx.nFe.findUnique({
            where: { id: sale.nfeReferencia.nfeReferenciaId },
            include: {
              unidadeDestino: { select: { ie: true, idCadIntTran: true } },
            },
          })
        : null;

      let symbolicShipmentDto: Record<string, unknown> | undefined;
      if (mainShipment) {
        const symbolicNumber = await proximoNumeroNfe(tx, tenant.id, series, numeroInicial);
        const symbolicKey = buildChaveNFe({
          uf: tenant.uf,
          cnpj: tenant.cnpj,
          serie: series,
          numero: symbolicNumber,
        });

        const destIe = await resolveDestIeForOperadorLogistico(tx, {
          marketplace: mainShipment.marketplace,
          fiscalPayload: mainShipment.fiscalPayload,
          destDoc: mainShipment.destDoc,
          unidadeDestino: mainShipment.unidadeDestino,
        });
        const idCadIntTran =
          mainShipment.unidadeDestino?.idCadIntTran?.trim() ||
          idCadIntTranFromRemessaFiscalPayload(mainShipment.fiscalPayload);

        let symbolicFiscal;
        try {
          // CAT 31 §4.2: reposição ao CD com os itens devolvidos — 1 NF-e, N <det>.
          symbolicFiscal = await prepareSymbolicShipmentFiscal(tx, {
            tenantId: tenant.id,
            emitUf: tenant.uf,
            destUf: mainShipment.destUf,
            itens: returnLines.map((line) => ({
              product: line.product,
              quantidade: line.quantidade,
            })),
            pedidoMl: sale.pedidoMl,
            // Reposição volta ao CD da remessa principal: mesmo marketplace dela.
            marketplace: mainShipment.marketplace,
            posDevolucao: {
              numero: returnRow.numero,
              serie: returnRow.serie,
              emitidaEm: returnRow.emitidaEm,
            },
            destIe,
            remessaSerie: series,
            idCadIntTran,
          });
        } catch (error) {
          if (error instanceof SymbolicShipmentFiscalError) {
            throw new DocumentReturnError(error.message, 422);
          }
          throw error;
        }

        const { calc, cfop: symbolicCfop, natOp, fiscalPayload } = symbolicFiscal;

        const symbolicRow = await tx.nFe.create({
          data: {
            tenantId: tenant.id,
            marketplace: mainShipment.marketplace,
            productId: product.id,
            chave: symbolicKey,
            numero: symbolicNumber,
            serie: series,
            natOp,
            cfop: symbolicCfop,
            ncm: product.ncm,
            destNome: mainShipment.destNome,
            destDoc: mainShipment.destDoc,
            destUf: mainShipment.destUf,
            destLogradouro: mainShipment.destLogradouro,
            destNumero: mainShipment.destNumero,
            destComplemento: mainShipment.destComplemento,
            destBairro: mainShipment.destBairro,
            destCodigoMunicipio: mainShipment.destCodigoMunicipio,
            destMunicipio: mainShipment.destMunicipio,
            destCep: mainShipment.destCep,
            destCodigoPais: mainShipment.destCodigoPais,
            destNomePais: mainShipment.destNomePais,
            destTelefone: mainShipment.destTelefone,
            destIndIeDest: mainShipment.destIndIeDest,
            valor: calc.valor,
            valorIcms: calc.valorIcms,
            aliqIcms: calc.aliqIcms,
            status: FiscalStatus.AUTORIZADA,
            emitidaEm: new Date(),
            pedidoMl: sale.pedidoMl,
            quantidade: quantity,
            tipo: NFeTipo.REMESSA_SIMBOLICA,
            saldoDisponivel: null,
            nfeReferenciaId: returnRow.id,
            unidadeDestinoId: mainShipment.unidadeDestinoId ?? undefined,
            fiscalPayload: fiscalPayload as Prisma.InputJsonValue,
          },
        });

        const symbolicItemRows = await createReturnItemRows(tx, {
          tenantId: tenant.id,
          nfeId: symbolicRow.id,
          cfop: symbolicCfop,
          lines: returnLines,
          engineItems: calc.nota.itens,
        });

        await persistNfeXmlFromEmission(tx, {
          nfeId: symbolicRow.id,
          tenant,
          productId: product.id,
          products: returnLines.map((line) => line.product),
          settings: emitterSettings,
          nfeReferenciaChave: returnRow.chave,
        });

        symbolicShipmentDto = mapNfe(symbolicRow, returnRow.chave, symbolicItemRows) as Record<
          string,
          unknown
        >;
      }

      return {
        devolucao: mapNfe(returnRow, sale.chave, returnItemRows) as Record<string, unknown>,
        remessaSimbolica: symbolicShipmentDto,
        saldoEstornado: reversals,
      };
    });
  }

  async getReturnableItems(input: ReturnableItemsInput): Promise<ReturnableItemsResult> {
    const sale = await this.loadSaleForReturn(input.tenantId, input.saleNfeKey);
    const saleLines = await this.resolveSaleLines(sale);
    const priorReturns = await this.loadPriorReturns(sale.id);
    const returnable = computeReturnableLines(
      saleLines.map((line) => ({
        numeroItem: line.numeroItem,
        productId: line.product.id,
        quantidade: line.quantidade,
      })),
      priorReturns,
    );

    const saleByNItem = new Map(saleLines.map((line) => [line.numeroItem, line]));
    const itens = returnable.map((line) => {
      const saleLine = saleByNItem.get(line.numeroItem);
      if (!saleLine) {
        throw new DocumentReturnError(
          `Item ${line.numeroItem} da venda não pôde ser associado ao catálogo.`,
          422,
        );
      }
      return {
        numeroItem: line.numeroItem,
        productId: line.productId,
        sku: saleLine.product.sku ?? null,
        nome: saleLine.product.nome,
        unidade: saleLine.product.unidade ?? "UN",
        quantidadeVendida: line.quantidade,
        quantidadeDevolvida: line.quantidadeDevolvida,
        quantidadeDisponivel: line.quantidadeDisponivel,
        valorUnitario: saleLine.valorUnitario,
      };
    });

    return {
      venda: {
        chave: sale.chave,
        numero: sale.numero,
        serie: sale.serie,
        quantidade: sale.quantidade,
      },
      itens,
      quantidadeDevolvida: itens.reduce((sum, item) => sum + item.quantidadeDevolvida, 0),
      quantidadeDisponivel: itens.reduce((sum, item) => sum + item.quantidadeDisponivel, 0),
      devolucoes: priorReturns.map((row) => ({
        chave: row.chave,
        numero: row.numero,
        serie: row.serie,
        tipo: row.tipo,
        quantidade: row.quantidade,
      })),
    };
  }

  private async loadSaleForReturn(tenantId: string, saleNfeKey: string): Promise<SaleForReturn> {
    const sale = await this.db.nFe.findFirst({
      where: { chave: saleNfeKey, tenantId },
      include: saleForReturnInclude,
    });

    if (!sale || sale.deletedAt) {
      throw new DocumentReturnError("NF-e de venda não encontrada.", 404);
    }
    if (sale.tipo !== NFeTipo.VENDA) {
      throw new DocumentReturnError("Só é possível devolver uma NF-e do tipo Venda.", 422);
    }
    return sale;
  }

  /** Devoluções/insucessos já emitidos para a venda (ordem de emissão). */
  private async loadPriorReturns(saleId: string): Promise<PriorReturnRow[]> {
    return this.db.nFe.findMany({
      where: {
        tipo: { in: [...RETURN_TIPOS] },
        nfeReferenciaId: saleId,
        deletedAt: null,
      },
      select: {
        id: true,
        chave: true,
        numero: true,
        serie: true,
        tipo: true,
        quantidade: true,
        itens: { select: { productId: true, quantidade: true } },
      },
      orderBy: [{ emitidaEm: "asc" }, { numero: "asc" }],
    });
  }

  /**
   * Linhas (`<det>`) da venda com produto do catálogo.
   * Fonte: `fiscalPayload.engine.itens`; produto por posição no pedido faturado,
   * depois por SKU (`codigo` do engine) e, em venda de item único, o produto do cabeçalho.
   * Venda legada sem engine → linha única do produto do cabeçalho.
   */
  private async resolveSaleLines(sale: SaleForReturn): Promise<SaleLine[]> {
    const payload = (sale.fiscalPayload ?? {}) as Record<string, unknown>;
    const engine = parseOriginEngine(payload.engine);

    if (!engine) {
      if (!sale.product) {
        throw new DocumentReturnError("Venda sem produto vinculado; não é possível devolver.", 422);
      }
      const totalValue = num(sale.valor);
      return [
        {
          numeroItem: 1,
          product: sale.product,
          quantidade: sale.quantidade,
          valorUnitario: sale.quantidade > 0 ? totalValue / sale.quantidade : totalValue,
        },
      ];
    }

    const pedidoItens = sale.pedido?.itens ?? [];
    const pedidoAlinhado = pedidoItens.length === engine.itens.length;
    const bySku = new Map<string, Product>();
    for (const item of pedidoItens) {
      if (item.product.sku) bySku.set(item.product.sku, item.product);
    }
    if (sale.product?.sku) bySku.set(sale.product.sku, sale.product);

    const lines: SaleLine[] = [];
    for (const [index, engineItem] of engine.itens.entries()) {
      // nItem da NF-e = posição em `<det>` (MOC / nfe-xml). Não usar
      // engine.numeroItem: venda multi-item gravava 1 em todas as linhas.
      const numeroItem = index + 1;
      const codigo = typeof engineItem.codigo === "string" ? engineItem.codigo.trim() : "";

      let product: Product | undefined;
      const pedidoProduct = pedidoAlinhado ? pedidoItens[index]?.product : undefined;
      if (pedidoProduct && (!codigo || !pedidoProduct.sku || pedidoProduct.sku === codigo)) {
        product = pedidoProduct;
      }
      product ??= codigo ? bySku.get(codigo) : undefined;
      if (!product && codigo) {
        product =
          (await this.db.product.findFirst({ where: { tenantId: sale.tenantId, sku: codigo } })) ??
          undefined;
      }
      if (!product && engine.itens.length === 1 && sale.product) {
        product = sale.product;
      }
      if (!product) {
        throw new DocumentReturnError(
          `Não foi possível identificar o produto do item ${numeroItem} da venda${codigo ? ` (código ${codigo})` : ""}.`,
          422,
        );
      }

      lines.push({
        numeroItem,
        product,
        quantidade: engineItem.quantidade,
        valorUnitario: engineItem.valorUnitario,
      });
    }
    return lines;
  }
}

/**
 * Sale return NF-e (DEVOLUÇÃO) emission referencing the original sale.
 *
 * Fulfillment chain:
 *   SHIPMENT → SYMBOLIC RETURN → SALE → RETURN
 *
 * The return:
 *  - references the original sale NF-e (nfeReferenciaId → sale);
 *  - mirrors sale tax math (same rates/CST via engine), proportionally to the
 *    returned quantity of each line (partial returns by `nItem` are allowed
 *    until the sold quantities are exhausted);
 *  - applies return CST mapping from fiscal settings;
 *  - reverses FIFO balance consumed in the chain back to shipments (only the
 *    returned quantities);
 *  - re-ships the returned lines to the CD via a multi-item symbolic shipment
 *    (CAT 31 §4.2).
 */

import { normalizeTaxStCode } from "@msimulation-xml/fiscal-core";
import {
  FiscalStatus,
  NFeTipo,
  Prisma,
  type Product,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";
import {
  runFiscalTransaction,
  type DbClient,
  type PrismaTx,
} from "../../../../lib/db/prisma-tx.js";
import { mapNfe, num } from "../../presentation/mappers/fiscal-mappers.js";
import { buildChaveNFe } from "../../domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../domain/services/nfe-sequencia.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { enrichFiscalPayloadWithXTexto, resolveNumeroInicialNfe } from "@msimulation-xml/fiscal-core";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import {
  calcularNotaFiscal,
  type ItemFiscalResult,
  type NotaFiscalResult,
} from "../../../tax/domain/services/tax-engine.js";
import {
  mirrorOriginForDevolucao,
  parseOriginEngine,
} from "../../../tax/domain/services/mirror-origin-for-devolucao.js";
import { buildFiscalItem, resolveTaxRule, resolveIcmsFallbackRate, type CustomerType } from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../xml/nfe-xml-service.js";
import {
  collectRemessaSaldoProductIds,
  debitRemessaBalanceByNfeId,
  getNetRemessaNfeBalance,
  prepareRemessaFifoForOperation,
  reverseRemessaFifoConsumptionsForReturn,
  SaldoRemessaInsuficienteError,
  type ReturnFifoReversalLine,
} from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import {
  prepareSymbolicShipmentFiscal,
  SymbolicShipmentFiscalError,
} from "../../../remessas/infrastructure/fiscal/symbolic-shipment/index.js";
import { destIeRetornoFromRemessa } from "../../../remessas/domain/services/retorno-simbolico-dest.js";
import type {
  ProcessReturnResult,
  ReturnableItemsResult,
} from "../../domain/entities/lifecycle-result.entity.js";
import { DocumentReturnError } from "../../domain/errors/document-return.error.js";
import {
  computeReturnableLines,
  DevolucaoItensError,
  resolveRequestedReturnLines,
  type RequestedReturnLine,
  type ReturnableLine,
} from "../../domain/services/devolucao-itens.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import type {
  DocumentReturnPort,
  ProcessPhysicalReturnInput,
  ProcessPhysicalReturnResult,
  ProcessReturnInput,
  ReturnableItemsInput,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/** Linha (`<det>`) da venda com o produto do catálogo resolvido. */
type SaleLine = {
  numeroItem: number;
  product: Product;
  quantidade: number;
  valorUnitario: number;
};

/** Linha devolvida nesta operação, já validada, com o produto da venda. */
type ReturnLine = RequestedReturnLine & { product: Product };

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

export class PrismaDocumentReturnRepository implements DocumentReturnPort {
  private get db() {
    return getDbClient();
  }

  async processSaleReturn(input: ProcessReturnInput): Promise<ProcessReturnResult> {
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
      const emitterSettings = await loadEmitterSettings(tx, tenant.id);

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
      const invoice: NotaFiscalResult = originEngine
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
      const accessKey = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: series, numero: number });

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
      });

      const returnRow = await tx.nFe.create({
        data: {
          tenantId: tenant.id,
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

        symbolicShipmentDto = mapNfe(
          symbolicRow,
          returnRow.chave,
          symbolicItemRows,
        ) as Record<string, unknown>;
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

    const itens = returnable.map((line, index) => {
      const saleLine = saleLines[index]!;
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
        throw new DocumentReturnError(
          "Venda sem produto vinculado; não é possível devolver.",
          422,
        );
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
      const numeroItem =
        typeof engineItem.numeroItem === "number" && engineItem.numeroItem > 0
          ? engineItem.numeroItem
          : index + 1;
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

  async processPhysicalReturn(
    input: ProcessPhysicalReturnInput,
  ): Promise<ProcessPhysicalReturnResult> {
    const { tenantId, remessaNfeKey } = input;

    const remessa = await this.db.nFe.findFirst({
      where: { chave: remessaNfeKey, tenantId },
      include: {
        tenant: true,
        product: true,
        unidadeDestino: { select: { ie: true, idCadIntTran: true } },
      },
    });

    if (!remessa || remessa.deletedAt) {
      throw new DocumentReturnError("NF-e de remessa não encontrada.", 404);
    }
    if (remessa.tipo !== NFeTipo.REMESSA && remessa.tipo !== NFeTipo.REMESSA_AVANCO) {
      throw new DocumentReturnError(
        "Retorno físico só pode referenciar remessa ou remessa avanço.",
        422,
      );
    }
    if (!remessa.product) {
      throw new DocumentReturnError("Remessa sem produto vinculado.", 422);
    }

    const existing = await this.db.nFe.findFirst({
      where: {
        tipo: NFeTipo.RETORNO_FISICO,
        nfeReferenciaId: remessa.id,
        deletedAt: null,
      },
      select: { numero: true, serie: true },
    });
    if (existing) {
      throw new DocumentReturnError(
        `Esta remessa já possui retorno físico (NF-e ${existing.numero}/${existing.serie}).`,
        409,
      );
    }

    const quantityHeader = remessa.saldoDisponivel ?? remessa.quantidade;
    if (quantityHeader <= 0) {
      throw new DocumentReturnError("Remessa sem saldo disponível para retorno físico.", 422);
    }

    const tenant = remessa.tenant;
    const product = remessa.product;
    const series = tenant.serieRemessa;
    const destUf = remessa.destUf;
    const cfop = resolveRetornoFisicoCfop(tenant.uf, destUf);
    const natOp = "Outras Entradas - Retorno fisico de Deposito Temporario";
    const totalValue = num(remessa.valor);
    const unitValue = remessa.quantidade > 0 ? totalValue / remessa.quantidade : totalValue;

    return runFiscalTransaction(this.db, tenantId, async (tx) => {
      await prepareRemessaFifoForOperation(
        tx as unknown as Parameters<typeof prepareRemessaFifoForOperation>[0],
        tenant.id,
        product.id,
        product.sku ?? undefined,
      );
      const quantity = await getNetRemessaNfeBalance(tx, remessa.id, remessa.quantidade);
      if (quantity <= 0) {
        throw new DocumentReturnError("Remessa sem saldo disponível para retorno físico.", 422);
      }
      const lineValue = unitValue * quantity;

      const emitterSettings = await loadEmitterSettings(tx, tenant.id);
      const inboundTaxRule = await resolveTaxRule(tx, tenant.id, {
        originUf: tenant.uf,
        destinationUf: destUf,
        transactionType: "inbound",
        customerType: "taxpayer",
        ruleBaseId: product.taxRuleBaseId?.trim() || undefined,
      });
      const icmsFallbackRate =
        num(remessa.aliqIcms) ||
        resolveIcmsFallbackRate(tenant.uf, destUf, "inbound", emitterSettings);

      const fiscalItem = buildFiscalItem(
        {
          codigo: product.sku ?? product.id,
          descricao: product.nome,
          ncm: product.ncm,
          cfop,
          unidade: product.unidade ?? "UN",
          cest: product.cest ?? undefined,
          ean: product.ean ?? undefined,
          exTipi: product.exTipi ?? undefined,
          origem: product.origem ?? 0,
          quantidade: quantity,
          valorUnitario: unitValue,
        },
        inboundTaxRule,
        {
          ufOrigem: tenant.uf,
          ufDestino: destUf,
          customerType: "taxpayer",
          emitterSettings,
          // Tributação de entrada no CD (mesmo canal "remessa" / fullfilmentEntrada).
          operationTipo: "RETORNO_FISICO",
        },
        icmsFallbackRate,
      );
      const invoice = calcularNotaFiscal([fiscalItem]);
      const valorIcms = invoice.totais.vICMS;

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

      const destIe = await resolveDestIeForOperadorLogistico(tx, {
        fiscalPayload: remessa.fiscalPayload,
        destDoc: remessa.destDoc,
        unidadeDestino: remessa.unidadeDestino,
      });
      const taxSnapshot = enrichTaxSnapshot(
        taxSnapshotFromRule(inboundTaxRule, icmsFallbackRate, emitterSettings),
        {
          settings: emitterSettings,
          tipo: NFeTipo.RETORNO_FISICO,
          valor: lineValue,
          valorIcms,
          emitUf: tenant.uf,
          destUf,
          indFinal: 0,
        },
      );

      const row = await tx.nFe.create({
        data: {
          tenantId: tenant.id,
          productId: product.id,
          chave: accessKey,
          numero: number,
          serie: series,
          natOp,
          cfop,
          ncm: product.ncm,
          destNome: remessa.destNome,
          destDoc: remessa.destDoc,
          destUf: remessa.destUf,
          destLogradouro: remessa.destLogradouro,
          destNumero: remessa.destNumero,
          destComplemento: remessa.destComplemento,
          destBairro: remessa.destBairro,
          destCodigoMunicipio: remessa.destCodigoMunicipio,
          destMunicipio: remessa.destMunicipio,
          destCep: remessa.destCep,
          destCodigoPais: remessa.destCodigoPais,
          destNomePais: remessa.destNomePais,
          destTelefone: remessa.destTelefone,
          destIndIeDest: remessa.destIndIeDest,
          valor: lineValue,
          valorIcms,
          aliqIcms: fiscalItem.icms.pICMS || icmsFallbackRate,
          status: FiscalStatus.AUTORIZADA,
          emitidaEm: new Date(),
          pedidoMl: remessa.pedidoMl,
          quantidade: quantity,
          tipo: NFeTipo.RETORNO_FISICO,
          saldoDisponivel: null,
          nfeReferenciaId: remessa.id,
          fiscalPayload: enrichFiscalPayloadWithXTexto(
            {
              ...taxSnapshot,
              engine: invoice,
              ...(destIe ? { destIe } : {}),
            } as Record<string, unknown>,
            {
              tipo: NFeTipo.RETORNO_FISICO,
              cfop,
              natOp,
              pedidoMl: remessa.pedidoMl,
            },
          ) as Prisma.InputJsonValue,
        },
      });

      try {
        await debitRemessaBalanceByNfeId(
          tx,
          tenant.id,
          remessa.id,
          product.id,
          quantity,
          row.id,
          product.sku ?? undefined,
        );
      } catch (error) {
        if (error instanceof SaldoRemessaInsuficienteError) {
          throw new DocumentReturnError(error.message, 422);
        }
        throw error;
      }

      const saldoRestante = await getNetRemessaNfeBalance(tx, remessa.id, remessa.quantidade);
      await tx.nFe.update({
        where: { id: remessa.id },
        data: { saldoDisponivel: saldoRestante },
      });

      await persistNfeXmlFromEmission(tx, {
        nfeId: row.id,
        tenant,
        productId: product.id,
        settings: emitterSettings,
        nfeReferenciaChave: remessa.chave,
      });

      return {
        retornoFisico: mapNfe(row, remessa.chave) as Record<string, unknown>,
        saldoConsumido: { remessaNfeId: remessa.id, quantidade: quantity },
      };
    });
  }
}

function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

/**
 * Persiste as linhas (`nfe_itens`) da devolução / remessa simbólica pós-devolução.
 * `saldoDisponivel` fica nulo: essas notas não alimentam o FIFO de remessas.
 */
async function createReturnItemRows(
  tx: PrismaTx,
  args: {
    tenantId: string;
    nfeId: string;
    cfop: string;
    lines: ReturnLine[];
    engineItems: ItemFiscalResult[];
  },
) {
  const rows = [];
  for (const [index, line] of args.lines.entries()) {
    const engineItem = args.engineItems[index];
    if (!engineItem) {
      throw new DocumentReturnError(
        `Falha ao calcular o item ${index + 1} da devolução.`,
        422,
      );
    }
    rows.push(
      await tx.nfeItem.create({
        data: {
          tenantId: args.tenantId,
          nfeId: args.nfeId,
          productId: line.product.id,
          numeroItem: index + 1,
          quantidade: line.quantidade,
          valor: engineItem.vProd,
          valorIcms: engineItem.icms.vICMS,
          ncm: line.product.ncm,
          cfop: args.cfop,
          saldoDisponivel: null,
        },
        include: { product: true },
      }),
    );
  }
  return rows;
}

/**
 * Linhas de estorno FIFO por produto: quantidade devolvida agora e quanto do mesmo
 * produto já havia sido devolvido (e estornado) antes. Inclui IDs legados do SKU.
 */
async function buildFifoReversalLines(
  tx: PrismaTx,
  tenantId: string,
  returnLines: ReturnLine[],
  returnable: ReturnableLine[],
): Promise<ReturnFifoReversalLine[]> {
  const byProduct = new Map<string, { product: Product; quantidade: number }>();
  for (const line of returnLines) {
    const acc = byProduct.get(line.product.id);
    if (acc) acc.quantidade += line.quantidade;
    else byProduct.set(line.product.id, { product: line.product, quantidade: line.quantidade });
  }

  const result: ReturnFifoReversalLine[] = [];
  for (const { product, quantidade } of byProduct.values()) {
    const jaEstornado = returnable
      .filter((line) => line.productId === product.id)
      .reduce((sum, line) => sum + line.quantidadeDevolvida, 0);
    const productIds = await collectRemessaSaldoProductIds(
      tx as unknown as Parameters<typeof collectRemessaSaldoProductIds>[0],
      tenantId,
      product.id,
      product.sku ?? undefined,
    );
    result.push({ productIds, quantidade, jaEstornado });
  }
  return result;
}

/** Return CFOP (inbound): interstate → 2202, intrastate → 1202. */
function resolveReturnCfop(emitterUf: string, destinationUf: string): string {
  return emitterUf.toUpperCase() !== destinationUf.toUpperCase() ? "2202" : "1202";
}

/** Retorno físico CFOP 1949/2949 (entrada contra o OL). */
function resolveRetornoFisicoCfop(emitterUf: string, destinationUf: string): string {
  return emitterUf.toUpperCase() === destinationUf.toUpperCase() ? "1949" : "2949";
}

/**
 * IE do Operador Logístico para `<dest><IE>` / `fiscalPayload.destIe`.
 * Ordem: payload da remessa → unidade vinculada → cadastro global por CNPJ do dest.
 * Conforme CAT 31 / MOC: com indIEDest=1 a IE do CD é obrigatória.
 */
async function resolveDestIeForOperadorLogistico(
  tx: PrismaTx,
  remessa: {
    fiscalPayload: unknown;
    destDoc: string;
    unidadeDestino?: { ie: string | null } | null;
  },
): Promise<string | undefined> {
  const fromChain = destIeRetornoFromRemessa(
    { fiscalPayload: remessa.fiscalPayload as Prisma.JsonValue },
    remessa.unidadeDestino ?? null,
  );
  if (fromChain) return fromChain;

  const cnpj = remessa.destDoc.replace(/\D/g, "");
  if (cnpj.length !== 14) return undefined;

  const unit = await tx.meliUnidadeLogistica.findUnique({
    where: { cnpj },
    select: { ie: true },
  });
  const digits = unit?.ie?.replace(/\D/g, "") ?? "";
  return digits || undefined;
}

function idCadIntTranFromRemessaFiscalPayload(payload: unknown): string | undefined {
  const root = (payload ?? {}) as Record<string, unknown>;
  const intermed = root.infIntermed as Record<string, unknown> | undefined;
  const id = intermed?.idCadIntTran;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

/**
 * `<entrega>` = OL onde a mercadoria retorna fisicamente (dest da remessa/retorno simbólico).
 */
function entregaFromOperadorLogistico(
  ol: {
    destDoc: string;
    destNome: string;
    destLogradouro: string | null;
    destNumero: string | null;
    destComplemento: string | null;
    destBairro: string | null;
    destCodigoMunicipio: string | null;
    destMunicipio: string | null;
    destUf: string;
    destCep: string | null;
    destCodigoPais: number | null;
    destNomePais: string | null;
    destTelefone: string | null;
  } | null | undefined,
): Record<string, unknown> | undefined {
  if (!ol) return undefined;
  const cnpj = String(ol.destDoc ?? "").replace(/\D/g, "");
  if (cnpj.length !== 14) return undefined;
  if (!ol.destLogradouro?.trim() || !ol.destCodigoMunicipio?.trim() || !ol.destUf?.trim()) {
    return undefined;
  }
  return {
    CNPJ: cnpj,
    xNome: ol.destNome,
    xLgr: ol.destLogradouro,
    nro: ol.destNumero?.trim() || "S/N",
    ...(ol.destComplemento?.trim() ? { xCpl: ol.destComplemento.trim() } : {}),
    xBairro: ol.destBairro?.trim() || "S/N",
    cMun: ol.destCodigoMunicipio.trim(),
    xMun: ol.destMunicipio?.trim() || ol.destCodigoMunicipio.trim(),
    UF: ol.destUf.trim().toUpperCase(),
    ...(ol.destCep ? { CEP: String(ol.destCep).replace(/\D/g, "").padStart(8, "0").slice(0, 8) } : {}),
    ...(ol.destCodigoPais != null ? { cPais: String(ol.destCodigoPais) } : {}),
    ...(ol.destNomePais ? { xPais: ol.destNomePais } : {}),
    ...(ol.destTelefone
      ? { fone: String(ol.destTelefone).replace(/\D/g, "") }
      : {}),
  };
}

/** Mantém `infIntermed` da venda/remessa (NT 2023.004 / marketplace). */
function resolveInfIntermedForReturn(
  salePayload: Record<string, unknown> | undefined,
  olNfe: { fiscalPayload: unknown } | null | undefined,
): { CNPJ?: string; idCadIntTran: string } | undefined {
  const fromSale = salePayload?.infIntermed;
  if (fromSale && typeof fromSale === "object" && !Array.isArray(fromSale)) {
    const id = (fromSale as Record<string, unknown>).idCadIntTran;
    if (typeof id === "string" && id.trim()) {
      return fromSale as { CNPJ?: string; idCadIntTran: string };
    }
  }
  const idFromOl = idCadIntTranFromRemessaFiscalPayload(olNfe?.fiscalPayload);
  if (!idFromOl) return undefined;
  const olRoot = (olNfe?.fiscalPayload ?? {}) as Record<string, unknown>;
  const olIntermed = olRoot.infIntermed as Record<string, unknown> | undefined;
  const cnpj =
    typeof olIntermed?.CNPJ === "string" ? olIntermed.CNPJ.replace(/\D/g, "") : undefined;
  return {
    ...(cnpj && cnpj.length === 14 ? { CNPJ: cnpj } : {}),
    idCadIntTran: idFromOl,
  };
}

function extractCstFromPayload(payload: unknown): {
  icms?: string;
  pis?: string;
  cofins?: string;
} {
  const root = (payload ?? {}) as Record<string, unknown>;
  const icms = (root.icms ?? {}) as Record<string, unknown>;
  const pis = (root.pis ?? {}) as Record<string, unknown>;
  const cofins = (root.cofins ?? {}) as Record<string, unknown>;
  const asCst = (value: unknown): string | undefined => {
    const code = normalizeTaxStCode(value);
    return code || undefined;
  };
  return {
    icms: asCst(icms.cst),
    pis: asCst(pis.st),
    cofins: asCst(cofins.st),
  };
}

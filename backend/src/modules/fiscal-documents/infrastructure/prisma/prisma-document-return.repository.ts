/**
 * Sale return NF-e (DEVOLUÇÃO) emission referencing the original sale.
 *
 * Fulfillment chain:
 *   SHIPMENT → SYMBOLIC RETURN → SALE → RETURN
 *
 * The return:
 *  - references the original sale NF-e (nfeReferenciaId → sale);
 *  - mirrors sale tax math (same rates/CST via engine);
 *  - applies return CST mapping from fiscal settings;
 *  - reverses FIFO balance consumed in the chain back to shipments.
 */

import { normalizeTaxStCode } from "@msimulation-xml/fiscal-core";
import {
  FiscalStatus,
  NFeTipo,
  Prisma,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";
import { runFiscalTransaction, type DbClient } from "../../../../lib/db/prisma-tx.js";
import { mapNfe, num } from "../../presentation/mappers/fiscal-mappers.js";
import { buildChaveNFe } from "../../domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../domain/services/nfe-sequencia.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { enrichFiscalPayloadWithXTexto, resolveNumeroInicialNfe } from "@msimulation-xml/fiscal-core";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import { calcularNotaFiscal } from "../../../tax/domain/services/tax-engine.js";
import {
  mirrorOriginForDevolucao,
  parseOriginEngine,
} from "../../../tax/domain/services/mirror-origin-for-devolucao.js";
import { buildFiscalItem, resolveTaxRule, resolveIcmsFallbackRate, type CustomerType } from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../xml/nfe-xml-service.js";
import {
  debitRemessaBalanceByNfeId,
  getNetRemessaNfeBalance,
  prepareRemessaFifoForOperation,
  reverseRemessaFifoConsumptions,
  SaldoRemessaInsuficienteError,
} from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import {
  prepareSymbolicShipmentFiscal,
  SymbolicShipmentFiscalError,
} from "../../../remessas/infrastructure/fiscal/symbolic-shipment/index.js";
import type { ProcessReturnResult } from "../../domain/entities/lifecycle-result.entity.js";
import { DocumentReturnError } from "../../domain/errors/document-return.error.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import type {
  DocumentReturnPort,
  ProcessPhysicalReturnInput,
  ProcessPhysicalReturnResult,
  ProcessReturnInput,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

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

    const sale = await this.db.nFe.findFirst({
      where: { chave: saleNfeKey, tenantId },
      include: { tenant: true, product: true, nfeReferencia: true },
    });

    if (!sale || sale.deletedAt) {
      throw new DocumentReturnError("NF-e de venda não encontrada.", 404);
    }
    if (sale.tipo !== NFeTipo.VENDA) {
      throw new DocumentReturnError("Só é possível devolver uma NF-e do tipo Venda.", 422);
    }
    if (!sale.product) {
      throw new DocumentReturnError("Venda sem produto vinculado; não é possível devolver.", 422);
    }

    const existingReturn = await this.db.nFe.findFirst({
      where: {
        tipo: { in: [NFeTipo.DEVOLUCAO, NFeTipo.INSULCESSO_DE_ENTREGA] },
        nfeReferenciaId: sale.id,
        deletedAt: null,
      },
      select: { id: true, numero: true, serie: true, tipo: true },
    });
    if (existingReturn) {
      throw new DocumentReturnError(
        `Esta venda já possui ${existingReturn.tipo === NFeTipo.INSULCESSO_DE_ENTREGA ? "insucesso de entrega" : "devolução"} (NF-e ${existingReturn.numero}/${existingReturn.serie}).`,
        409,
      );
    }

    const tenant = sale.tenant;
    const product = sale.product;
    const series = tenant.serieRemessa;
    const customerType = resolveCustomerType(sale.destIndIeDest);
    const quantity = sale.quantidade;
    const totalValue = num(sale.valor);
    const unitValue = quantity > 0 ? totalValue / quantity : totalValue;
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

      // Regra de ouro: espelhar engine da venda (proporcional). Fallback = recalcular TaxRule.
      const originEngine = parseOriginEngine(saleFiscalPayload?.engine);
      const invoice = originEngine
        ? mirrorOriginForDevolucao({
            origin: originEngine,
            ratio: 1,
            nonContributorIpi: customerType === "non_taxpayer",
          })
        : calcularNotaFiscal([
            buildFiscalItem(
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
            ),
          ]);

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

      await persistNfeXmlFromEmission(tx, {
        nfeId: returnRow.id,
        tenant,
        productId: product.id,
        settings: emitterSettings,
        nfeReferenciaChave: sale.chave,
      });

      const reversals = sale.nfeReferenciaId
        ? await reverseRemessaFifoConsumptions(tx, sale.nfeReferenciaId)
        : [];

      const mainShipment = sale.nfeReferencia?.nfeReferenciaId
        ? await tx.nFe.findUnique({ where: { id: sale.nfeReferencia.nfeReferenciaId } })
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

        let symbolicFiscal;
        try {
          symbolicFiscal = await prepareSymbolicShipmentFiscal(tx, {
            tenantId: tenant.id,
            emitUf: tenant.uf,
            destUf: mainShipment.destUf,
            product,
            quantidade: quantity,
            pedidoMl: sale.pedidoMl,
            posDevolucao: {
              numero: returnRow.numero,
              serie: returnRow.serie,
              emitidaEm: returnRow.emitidaEm,
            },
            destIe: destIeFromRemessaFiscalPayload(mainShipment.fiscalPayload),
            remessaSerie: series,
            idCadIntTran: idCadIntTranFromRemessaFiscalPayload(mainShipment.fiscalPayload),
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
            fiscalPayload: fiscalPayload as Prisma.InputJsonValue,
          },
        });

        await persistNfeXmlFromEmission(tx, {
          nfeId: symbolicRow.id,
          tenant,
          productId: product.id,
          settings: emitterSettings,
          nfeReferenciaChave: returnRow.chave,
        });

        symbolicShipmentDto = mapNfe(symbolicRow, returnRow.chave) as Record<string, unknown>;
      }

      return {
        devolucao: mapNfe(returnRow, sale.chave) as Record<string, unknown>,
        remessaSimbolica: symbolicShipmentDto,
        saldoEstornado: reversals,
      };
    });
  }

  async processPhysicalReturn(
    input: ProcessPhysicalReturnInput,
  ): Promise<ProcessPhysicalReturnResult> {
    const { tenantId, remessaNfeKey } = input;

    const remessa = await this.db.nFe.findFirst({
      where: { chave: remessaNfeKey, tenantId },
      include: { tenant: true, product: true },
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

      const destIe = destIeFromRemessaFiscalPayload(remessa.fiscalPayload);
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

/** Return CFOP (inbound): interstate → 2202, intrastate → 1202. */
function resolveReturnCfop(emitterUf: string, destinationUf: string): string {
  return emitterUf.toUpperCase() !== destinationUf.toUpperCase() ? "2202" : "1202";
}

/** Retorno físico CFOP 1949/2949 (entrada contra o OL). */
function resolveRetornoFisicoCfop(emitterUf: string, destinationUf: string): string {
  return emitterUf.toUpperCase() === destinationUf.toUpperCase() ? "1949" : "2949";
}

function destIeFromRemessaFiscalPayload(payload: unknown): string | undefined {
  const root = (payload ?? {}) as Record<string, unknown>;
  const destIe = root.destIe;
  return typeof destIe === "string" && destIe.trim() ? destIe.replace(/\D/g, "") : undefined;
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
    destCodigoPais: string | null;
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
    ...(ol.destCodigoPais ? { cPais: ol.destCodigoPais } : {}),
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

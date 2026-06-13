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
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { mapNfe, num } from "../../presentation/mappers/fiscal-mappers.js";
import { buildChaveNFe } from "../../domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../domain/services/nfe-sequencia.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { enrichFiscalPayloadWithXTexto } from "@msimulation-xml/fiscal-core";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import { calcularNotaFiscal } from "../../../tax/domain/services/tax-engine.js";
import { montarItemFiscal, resolveTaxRule, resolveIcmsFallbackRate, type CustomerType } from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../xml/nfe-xml-service.js";
import { estornarConsumosRemessa } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import {
  prepararRemessaSimbolicaFiscal,
  RemessaSimbolicaFiscalError,
} from "../../../remessas/infrastructure/fiscal/remessa-simbolica-fiscal.js";
import type { ProcessReturnResult } from "../../domain/entities/lifecycle-result.entity.js";
import { DocumentReturnError } from "../../domain/errors/document-return.error.js";
import type {
  DocumentReturnPort,
  ProcessReturnInput,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

export class PrismaDocumentReturnRepository implements DocumentReturnPort {
  constructor(private readonly prisma: PrismaClient) {}

  async processSaleReturn(input: ProcessReturnInput): Promise<ProcessReturnResult> {
    const { tenantId, saleNfeKey } = input;

    const sale = await this.prisma.nFe.findFirst({
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

    const existingReturn = await this.prisma.nFe.findFirst({
      where: { tipo: NFeTipo.DEVOLUCAO, nfeReferenciaId: sale.id, deletedAt: null },
      select: { id: true, numero: true, serie: true },
    });
    if (existingReturn) {
      throw new DocumentReturnError(
        `Esta venda já possui devolução (NF-e ${existingReturn.numero}/${existingReturn.serie}).`,
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

    return runFiscalTransaction(this.prisma, tenantId, async (tx) => {
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

      const fiscalItem = montarItemFiscal(
        {
          codigo: product.sku ?? product.id,
          descricao: product.nome,
          ncm: product.ncm,
          cfop,
          unidade: product.unidade ?? "UN",
          cest: product.cest,
          ean: product.ean ?? undefined,
          exTipi: product.exTipi ?? undefined,
          origem: product.origem ?? 0,
          quantidade: quantity,
          valorUnitario: unitValue,
        },
        saleTaxRule,
        {
          ufOrigem: tenant.uf,
          ufDestino: sale.destUf,
          customerType,
          emitterSettings,
          operationTipo: "DEVOLUCAO",
          cstVendaReferencia: referencedSaleCst,
        },
        icmsFallbackRate,
      );
      const invoice = calcularNotaFiscal([fiscalItem]);

      const returnIcmsRate = fiscalItem.icms.pICMS || icmsFallbackRate;
      const returnIcmsValue = invoice.totais.vICMS;

      const number = await proximoNumeroNfe(tx, tenant.id, series);
      const accessKey = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: series, numero: number });

      const taxSnapshot = enrichTaxSnapshot(
        taxSnapshotFromRule(saleTaxRule, icmsFallbackRate, emitterSettings),
        {
        settings: emitterSettings,
        tipo: NFeTipo.DEVOLUCAO,
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
          natOp: "Devolucao de mercadorias",
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
          valor: totalValue,
          valorIcms: returnIcmsValue,
          aliqIcms: returnIcmsRate,
          status: FiscalStatus.AUTORIZADA,
          emitidaEm: new Date(),
          pedidoMl: sale.pedidoMl,
          quantidade: quantity,
          tipo: NFeTipo.DEVOLUCAO,
          saldoDisponivel: null,
          nfeReferenciaId: sale.id,
          fiscalPayload: enrichFiscalPayloadWithXTexto(
            { ...taxSnapshot, engine: invoice } as Record<string, unknown>,
            {
              tipo: NFeTipo.DEVOLUCAO,
              cfop,
              natOp: "Devolucao de mercadorias",
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
        ? await estornarConsumosRemessa(tx, sale.nfeReferenciaId)
        : [];

      const mainShipment = sale.nfeReferencia?.nfeReferenciaId
        ? await tx.nFe.findUnique({ where: { id: sale.nfeReferencia.nfeReferenciaId } })
        : null;

      let symbolicShipmentDto: Record<string, unknown> | undefined;
      if (mainShipment) {
        const symbolicNumber = await proximoNumeroNfe(tx, tenant.id, series);
        const symbolicKey = buildChaveNFe({
          uf: tenant.uf,
          cnpj: tenant.cnpj,
          serie: series,
          numero: symbolicNumber,
        });

        let symbolicFiscal;
        try {
          symbolicFiscal = await prepararRemessaSimbolicaFiscal(tx, {
            tenantId: tenant.id,
            emitUf: tenant.uf,
            destUf: mainShipment.destUf,
            product,
            quantidade: quantity,
            pedidoMl: sale.pedidoMl,
          });
        } catch (error) {
          if (error instanceof RemessaSimbolicaFiscalError) {
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
}

function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

/** Return CFOP (inbound): interstate → 2202, intrastate → 1202. */
function resolveReturnCfop(emitterUf: string, destinationUf: string): string {
  return emitterUf.toUpperCase() !== destinationUf.toUpperCase() ? "2202" : "1202";
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

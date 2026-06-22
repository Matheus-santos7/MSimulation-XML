import {
  enrichFiscalPayloadMlVenda,
  enrichFiscalPayloadWithXTexto,
  resolveFiscalExitUf,
  resolveNumeroInicialNfe,
  resolveSaleCfop,
  VENDA_ML_NAT_OP,
} from "@msimulation-xml/fiscal-core";
import { FiscalStatus, NFeTipo, Prisma } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../fiscal-documents/domain/services/nfe-chave.js";
import { enrichTaxSnapshot } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { proximoNumeroNfe } from "../../../fiscal-documents/domain/services/nfe-sequencia.js";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import { calcularNotaFiscal } from "../../../tax/domain/services/tax-engine.js";
import type { Tenant } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { buildFiscalItem } from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import type { EmissionContext } from "../../domain/entities/emission-context.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { ReturnNoteCreated, SalesChainRules } from "../../application/dto/sales-chain.dto.js";
import {
  inferIcmsRateForSale,
  resolveDestIeForFiscalPayload,
  saleDestinationAddress,
} from "../../domain/services/sales-chain.service.js";

function autXmlCpfsFromSettings(
  settings: SalesChainRules["emitterSettings"],
): string[] | undefined {
  const cpfs = settings.nfe.autXmlCpfs?.filter((c) => c.replace(/\D/g, "").length === 11);
  return cpfs?.length ? cpfs : undefined;
}

/**
 * Emite NF-e **VENDA** ao comprador final, referenciando o retorno simbólico.
 *
 * Usa `valorTotalVenda`, regra sale e endereço do destinatário (`saleDestinationAddress`).
 */
export async function emitSaleNote(
  tx: PrismaTx,
  order: OrderForEmit,
  ctx: EmissionContext,
  rules: SalesChainRules,
  returnNote: ReturnNoteCreated,
  stockUf: string,
  stockCodigoMunicipio?: string,
) {
  const { tenant } = order;
  const { saleTaxRule, customerType, emitterSettings } = rules;
  const fiscalExitUf = resolveFiscalExitUf(tenant.uf, stockUf);

  const numeroInicial = resolveNumeroInicialNfe(emitterSettings, ctx.serie, {
    serieRemessa: tenant.serieRemessa,
    serieTransferencia: tenant.serieRemessa,
  });
  const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie, numeroInicial);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });
  const fallbackRate = inferIcmsRateForSale(fiscalExitUf, order.destUf, emitterSettings);
  const cfop = resolveSaleCfop(fiscalExitUf, order.destUf, customerType, saleTaxRule.cfop);
  const natOp = VENDA_ML_NAT_OP;
  const valorFrete = order.valorFrete ?? 0;
  const xPed = order.mlPackId?.trim() || undefined;
  const autXmlCpfs = autXmlCpfsFromSettings(emitterSettings);
  const nfci = order.product.nfci?.trim() || undefined;

  const saleItem = buildFiscalItem(
    {
      codigo: order.product.sku ?? order.product.id,
      descricao: order.product.nome ?? "Mercadoria",
      ncm: order.product.ncm,
      cfop,
      unidade: order.product.unidade ?? "UN",
      cest: order.product.cest ?? undefined,
      ean: order.product.ean ?? undefined,
      exTipi: order.product.exTipi ?? undefined,
      origem: order.product.origem ?? 0,
      quantidade: order.quantidade,
      valorUnitario: ctx.valorUnitVenda,
      frete: valorFrete,
    },
    saleTaxRule,
    {
      ufOrigem: tenant.uf,
      ufSaidaFisica: fiscalExitUf,
      ufDestino: order.destUf,
      customerType,
      emitterSettings,
      operationTipo: "VENDA",
    },
    fallbackRate,
  );
  const saleInvoice = calcularNotaFiscal([saleItem]);

  const icmsRate = saleItem.icms.pICMS || fallbackRate;
  const icmsValue = saleInvoice.totais.vICMS;
  const crossUfFulfillment = fiscalExitUf.toUpperCase() !== tenant.uf.toUpperCase();
  const cMunSaidaFisica = stockCodigoMunicipio?.trim() || undefined;
  const destIe = resolveDestIeForFiscalPayload(order.destIndIeDest, order.destIe);

  const saleRow = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: order.product.id,
      chave,
      numero,
      serie: ctx.serie,
      natOp,
      cfop,
      ncm: order.product.ncm,
      ...saleDestinationAddress(order),
      valor: ctx.valorTotalVenda,
      valorIcms: icmsValue,
      aliqIcms: icmsRate,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: order.quantidade,
      tipo: NFeTipo.VENDA,
      nfeReferenciaId: returnNote.id,
      fiscalPayload: enrichFiscalPayloadWithXTexto(
        enrichFiscalPayloadMlVenda(
          {
            ...enrichTaxSnapshot(taxSnapshotFromRule(saleTaxRule, fallbackRate, emitterSettings), {
              settings: emitterSettings,
              tipo: NFeTipo.VENDA,
              valor: ctx.valorTotalVenda,
              valorIcms: icmsValue,
              emitUf: fiscalExitUf,
              destUf: order.destUf,
              indFinal: 1,
            }),
            engine: saleInvoice,
            ufSaidaFisica: fiscalExitUf,
            ...(crossUfFulfillment && cMunSaidaFisica ? { cMunSaidaFisica } : {}),
            ...(autXmlCpfs ? { autXmlCpfs } : {}),
            ...(nfci ? { nfci } : {}),
            ...(xPed ? { xPed } : {}),
            ...(valorFrete > 0 ? { valorFrete } : {}),
            ...(destIe ? { destIe } : {}),
          } as Record<string, unknown>,
          {
            quantidade: order.quantidade,
            valorFrete,
            xPed,
            nfci,
            autXmlCpfs,
            returnNote: {
              numero: returnNote.numero,
              serie: returnNote.serie,
              emitidaEm: returnNote.emitidaEm,
            },
          },
        ),
        {
          tipo: NFeTipo.VENDA,
          cfop,
          natOp,
          pedidoMl: ctx.pedidoMl,
          indFinal: 1,
        },
      ) as Prisma.InputJsonValue,
    },
  });

  await persistNfeXmlFromEmission(tx, {
    nfeId: saleRow.id,
    tenant: tenant as Tenant,
    productId: order.product.id,
    settings: emitterSettings,
    nfeReferenciaChave: returnNote.chave,
  });

  return saleRow;
}

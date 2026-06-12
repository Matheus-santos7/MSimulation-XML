import { enrichFiscalPayloadWithXTexto } from "@msimulation-xml/fiscal-core";
import { FiscalStatus, NFeTipo, Prisma } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../../lib/fiscal/nfe-chave.js";
import { enrichTaxSnapshot } from "../../../../lib/fiscal/fiscal-emitter-runtime.js";
import { proximoNumeroNfe } from "../../../../lib/fiscal/nfe-sequencia.js";
import { taxSnapshotFromRule } from "../../../../lib/fiscal/tax-snapshot.js";
import { calcularNotaFiscal } from "../../../../lib/fiscal/tax-engine.js";
import type { Tenant } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { montarItemFiscal } from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../../../../services/fiscal/shared/nfe-xml-service.js";
import type { EmissionContext } from "../../domain/entities/emission-context.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { ReturnNoteCreated, SalesChainRules } from "../../application/dto/sales-chain.dto.js";
import {
  inferIcmsRateForSale,
  saleDestinationAddress,
} from "../../domain/services/sales-chain.service.js";

export async function emitSaleNote(
  tx: PrismaTx,
  order: OrderForEmit,
  ctx: EmissionContext,
  rules: SalesChainRules,
  returnNote: ReturnNoteCreated,
) {
  const { tenant } = order;
  const { saleTaxRule, customerType, emitterSettings } = rules;

  const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });
  const fallbackRate = inferIcmsRateForSale(tenant.uf, order.destUf);

  const saleItem = montarItemFiscal(
    {
      codigo: order.product.sku ?? order.product.id,
      descricao: order.product.nome ?? "Mercadoria",
      ncm: order.product.ncm,
      cfop: saleTaxRule.cfop ?? "",
      unidade: order.product.unidade ?? "UN",
      cest: order.product.cest,
      ean: order.product.ean ?? undefined,
      exTipi: order.product.exTipi ?? undefined,
      origem: order.product.origem ?? 0,
      quantidade: order.quantidade,
      valorUnitario: ctx.valorUnitVenda,
    },
    saleTaxRule,
    { ufOrigem: tenant.uf, ufDestino: order.destUf, customerType },
    fallbackRate,
  );
  const saleInvoice = calcularNotaFiscal([saleItem]);

  const icmsRate = saleItem.icms.pICMS || fallbackRate;
  const icmsValue = saleInvoice.totais.vICMS;
  const natOp =
    customerType === "non_taxpayer"
      ? "Venda de mercadoria para consumidor final"
      : "Venda de mercadorias";
  const cfop = saleTaxRule.cfop ?? "";

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
        {
          ...enrichTaxSnapshot(taxSnapshotFromRule(saleTaxRule, fallbackRate), {
            settings: emitterSettings,
            tipo: NFeTipo.VENDA,
            valor: ctx.valorTotalVenda,
            valorIcms: icmsValue,
            emitUf: tenant.uf,
            destUf: order.destUf,
            indFinal: 1,
          }),
          engine: saleInvoice,
        } as Record<string, unknown>,
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

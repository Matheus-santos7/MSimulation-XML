import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
} from "@msimulation-xml/fiscal-core";
import { FiscalStatus, NFeTipo, Prisma } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../fiscal-documents/domain/services/nfe-chave.js";
import { enrichTaxSnapshot } from "../../../../lib/fiscal/fiscal-emitter-runtime.js";
import { proximoNumeroNfe } from "../../../fiscal-documents/domain/services/nfe-sequencia.js";
import {
  destIeRetornoFromRemessa,
  destinoRetornoFromRemessa,
  resolveRetornoSimbolicoCfop,
  RETORNO_SIMBOLICO_NAT_OP,
} from "../../../../lib/fiscal/retorno-simbolico-dest.js";
import { taxSnapshotFromRule } from "../../../../lib/fiscal/tax-snapshot.js";
import type { Tenant } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import {
  calcularNotaInbound,
  inferAliqIcmsIntraestadual,
  linhaPedidoFromProduto,
} from "../../../tax/index.js";
import {
  consumirSaldoRemessaFifoParaVenda,
  loadRemessaDestinoRetorno,
  type PreviewRemessaFifoVenda,
} from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import { persistNfeXmlFromEmission } from "../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import type { EmissionContext } from "../../domain/entities/emission-context.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { ReturnNoteCreated, SalesChainRules } from "../../application/dto/sales-chain.dto.js";

function autXmlCpfsFromSettings(
  settings: SalesChainRules["emitterSettings"],
): string[] | undefined {
  const cpfs = settings.nfe.autXmlCpfs?.filter((c) => c.replace(/\D/g, "").length === 11);
  return cpfs?.length ? cpfs : undefined;
}

/**
 * Emite NF-e **RETORNO_SIMBOLICO** referenciando a remessa física FIFO.
 *
 * Usa `valorTotalCusto` do contexto e regra inbound; persiste XML autorizado.
 */
export async function emitReturnNote(
  tx: PrismaTx,
  order: OrderForEmit,
  ctx: EmissionContext,
  rules: SalesChainRules,
  fifoPreview: PreviewRemessaFifoVenda,
): Promise<ReturnNoteCreated> {
  const { tenant } = order;
  const { inboundTaxRule, emitterSettings } = rules;

  const remessa = await loadRemessaDestinoRetorno(tx, fifoPreview.remessaNfeId);
  const destUf = remessa.destUf;
  const destino = destinoRetornoFromRemessa(remessa, remessa.unidadeDestino);
  const destIe = destIeRetornoFromRemessa(remessa, remessa.unidadeDestino);

  const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });

  const fallbackRate = inferAliqIcmsIntraestadual(tenant.uf, destUf);
  const cfop = resolveRetornoSimbolicoCfop(tenant.uf, destUf);
  const calc = calcularNotaInbound(
    linhaPedidoFromProduto(order.product, {
      cfop,
      quantidade: order.quantidade,
      valorUnitario: ctx.valorUnitCusto,
    }),
    inboundTaxRule,
    tenant.uf,
    destUf,
    fallbackRate,
  );
  const { valor, valorIcms, aliqIcms } = calc;

  const idCadIntTran = remessa.unidadeDestino?.idCadIntTran?.trim() || undefined;
  const autXmlCpfs = autXmlCpfsFromSettings(emitterSettings);

  const row = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: order.product.id,
      chave,
      numero,
      serie: ctx.serie,
      natOp: RETORNO_SIMBOLICO_NAT_OP,
      cfop,
      ncm: order.product.ncm,
      ...destino,
      valor,
      valorIcms,
      aliqIcms,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: order.quantidade,
      tipo: NFeTipo.RETORNO_SIMBOLICO,
      saldoDisponivel: null,
      nfeReferenciaId: remessa.id,
      fiscalPayload: enrichFiscalPayloadMlFulfillment(
        enrichFiscalPayloadWithXTexto(
          {
            ...enrichTaxSnapshot(taxSnapshotFromRule(inboundTaxRule, fallbackRate), {
              settings: emitterSettings,
              tipo: NFeTipo.RETORNO_SIMBOLICO,
              valor,
              valorIcms,
              emitUf: tenant.uf,
              destUf,
              indFinal: 0,
            }),
            engine: calc.nota,
            ...(destIe ? { destIe } : {}),
            ...(order.product.exTipi ? { exTipi: order.product.exTipi } : {}),
          } as Record<string, unknown>,
          {
            tipo: NFeTipo.RETORNO_SIMBOLICO,
            cfop,
            natOp: RETORNO_SIMBOLICO_NAT_OP,
            pedidoMl: ctx.pedidoMl,
          },
        ),
        {
          quantidadeTotal: order.quantidade,
          withLogistics: false,
          destIe,
          idCadIntTran,
          autXmlCpfs,
        },
      ) as Prisma.InputJsonValue,
    },
  });

  return { id: row.id, chave: row.chave, remessaChave: fifoPreview.remessaChave };
}

/**
 * Debita saldo FIFO da remessa e associa consumos ao retorno simbólico emitido.
 *
 * @returns Alocações `{ remessaNfeId, nfeItemId, quantidade }` para auditoria
 */
export async function consumeShipmentAndLinkReturn(
  tx: PrismaTx,
  order: OrderForEmit,
  returnNote: ReturnNoteCreated,
  emitterSettings: SalesChainRules["emitterSettings"],
) {
  const allocations = await consumirSaldoRemessaFifoParaVenda(
    tx,
    order.tenant.id,
    order.product.id,
    order.quantidade,
    returnNote.id,
    order.destUf,
    order.product.sku,
  );

  await persistNfeXmlFromEmission(tx, {
    nfeId: returnNote.id,
    tenant: order.tenant as Tenant,
    productId: order.product.id,
    settings: emitterSettings,
    nfeReferenciaChave: returnNote.remessaChave,
  });

  return allocations;
}

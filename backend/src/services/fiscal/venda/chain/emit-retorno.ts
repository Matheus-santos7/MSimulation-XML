import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
} from "@msimulation-xml/fiscal-core";
import { FiscalStatus, NFeTipo, Prisma } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../../lib/fiscal/nfe-chave.js";
import { enrichTaxSnapshot } from "../../../../lib/fiscal/fiscal-emitter-runtime.js";
import { proximoNumeroNfe } from "../../../../lib/fiscal/nfe-sequencia.js";
import {
  destIeRetornoFromRemessa,
  destinoRetornoFromRemessa,
  resolveRetornoSimbolicoCfop,
  RETORNO_SIMBOLICO_NAT_OP,
} from "../../../../lib/fiscal/retorno-simbolico-dest.js";
import { taxSnapshotFromRule } from "../../../../lib/fiscal/tax-snapshot.js";
import {
  calcularNotaInbound,
  inferAliqIcmsIntraestadual,
  linhaPedidoFromProduto,
} from "../../tax/tax-calculation-service.js";
import {
  consumirSaldoRemessaFifoParaVenda,
  loadRemessaDestinoRetorno,
  type PreviewRemessaFifoVenda,
} from "../../remessa/remessa-fifo.js";
import { persistNfeXmlFromEmission } from "../../shared/nfe-xml-service.js";
import type {
  ContextoEmissao,
  NotaRetornoCriada,
  PedidoForEmit,
  RegrasCadeiaVenda,
  VendaChainTx,
} from "./types.js";

function autXmlCpfsFromSettings(
  settings: RegrasCadeiaVenda["emitterSettings"],
): string[] | undefined {
  const cpfs = settings.nfe.autXmlCpfs?.filter((c) => c.replace(/\D/g, "").length === 11);
  return cpfs?.length ? cpfs : undefined;
}

export async function emitirNotaRetorno(
  tx: VendaChainTx,
  pedido: PedidoForEmit,
  ctx: ContextoEmissao,
  regras: RegrasCadeiaVenda,
  previewFifo: PreviewRemessaFifoVenda,
): Promise<NotaRetornoCriada> {
  const { tenant } = pedido;
  const { inboundTaxRule, emitterSettings } = regras;

  const remessa = await loadRemessaDestinoRetorno(tx, previewFifo.remessaNfeId);
  const destUf = remessa.destUf;
  const destino = destinoRetornoFromRemessa(remessa, remessa.unidadeDestino);
  const destIe = destIeRetornoFromRemessa(remessa, remessa.unidadeDestino);

  const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });

  const aliqFallback = inferAliqIcmsIntraestadual(tenant.uf, destUf);
  const cfop = resolveRetornoSimbolicoCfop(tenant.uf, destUf);
  const calc = calcularNotaInbound(
    linhaPedidoFromProduto(pedido.product, {
      cfop,
      quantidade: pedido.quantidade,
      valorUnitario: ctx.valorUnitCusto,
    }),
    inboundTaxRule,
    tenant.uf,
    destUf,
    aliqFallback,
  );
  const { valor, valorIcms, aliqIcms } = calc;

  const idCadIntTran = remessa.unidadeDestino?.idCadIntTran?.trim() || undefined;
  const autXmlCpfs = autXmlCpfsFromSettings(emitterSettings);

  const row = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: pedido.product.id,
      chave,
      numero,
      serie: ctx.serie,
      natOp: RETORNO_SIMBOLICO_NAT_OP,
      cfop,
      ncm: pedido.product.ncm,
      ...destino,
      valor,
      valorIcms,
      aliqIcms,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: pedido.quantidade,
      tipo: NFeTipo.RETORNO_SIMBOLICO,
      saldoDisponivel: null,
      nfeReferenciaId: remessa.id,
      fiscalPayload: enrichFiscalPayloadMlFulfillment(
        enrichFiscalPayloadWithXTexto(
          {
            ...enrichTaxSnapshot(taxSnapshotFromRule(inboundTaxRule, aliqFallback), {
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
            ...(pedido.product.exTipi ? { exTipi: pedido.product.exTipi } : {}),
          } as Record<string, unknown>,
          {
            tipo: NFeTipo.RETORNO_SIMBOLICO,
            cfop,
            natOp: RETORNO_SIMBOLICO_NAT_OP,
            pedidoMl: ctx.pedidoMl,
          },
        ),
        {
          quantidadeTotal: pedido.quantidade,
          withLogistics: false,
          destIe,
          idCadIntTran,
          autXmlCpfs,
        },
      ) as Prisma.InputJsonValue,
    },
  });

  return { id: row.id, chave: row.chave, remessaChave: previewFifo.remessaChave };
}

/**
 * Debita remessas (FIFO) e confirma `nfeReferenciaId` do retorno → remessa principal.
 * Deve rodar logo após criar o retorno, antes da venda.
 */
export async function consumirRemessaEVincularRetorno(
  tx: VendaChainTx,
  pedido: PedidoForEmit,
  retorno: NotaRetornoCriada,
  emitterSettings: RegrasCadeiaVenda["emitterSettings"],
) {
  const alocacoes = await consumirSaldoRemessaFifoParaVenda(
    tx,
    pedido.tenant.id,
    pedido.product.id,
    pedido.quantidade,
    retorno.id,
    pedido.destUf,
    pedido.product.sku,
  );

  await persistNfeXmlFromEmission(tx, {
    nfeId: retorno.id,
    tenant: pedido.tenant,
    productId: pedido.product.id,
    settings: emitterSettings,
    nfeReferenciaChave: retorno.remessaChave,
  });

  return alocacoes;
}

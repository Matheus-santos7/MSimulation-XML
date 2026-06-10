import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
} from "@msimulation-xml/fiscal-core";
import { FiscalStatus, NFeTipo, Prisma } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../../lib/fiscal/nfe-chave.js";
import { enrichTaxSnapshot } from "../../../../lib/fiscal/fiscal-emitter-runtime.js";
import { proximoNumeroNfe } from "../../../../lib/fiscal/nfe-sequencia.js";
import {
  RETORNO_SIMBOLICO_CFOP,
  RETORNO_SIMBOLICO_NAT_OP,
} from "../../../../lib/fiscal/retorno-simbolico-dest.js";
import { taxSnapshotFromRule } from "../../../../lib/fiscal/tax-snapshot.js";
import {
  calcularNotaInbound,
  inferAliqIcmsIntraestadual,
  linhaPedidoFromProduto,
} from "../../tax/tax-calculation-service.js";
import { consumirSaldoRemessaFifoParaVenda } from "../../remessa/remessa-fifo.js";
import { persistNfeXmlFromEmission } from "../../shared/nfe-xml-service.js";
import { enderecoDestRetorno } from "./context.js";
import type {
  ContextoEmissao,
  NotaRetornoCriada,
  PedidoForEmit,
  RegrasCadeiaVenda,
  VendaChainTx,
} from "./types.js";

export async function emitirNotaRetorno(
  tx: VendaChainTx,
  pedido: PedidoForEmit,
  ctx: ContextoEmissao,
  regras: RegrasCadeiaVenda,
): Promise<NotaRetornoCriada> {
  const { tenant } = pedido;
  const { inboundTaxRule, emitterSettings } = regras;

  const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });

  const aliqFallback = inferAliqIcmsIntraestadual(tenant.uf, tenant.uf);
  const cfop = inboundTaxRule.cfop ?? RETORNO_SIMBOLICO_CFOP;
  const calc = calcularNotaInbound(
    linhaPedidoFromProduto(pedido.product, {
      cfop,
      quantidade: pedido.quantidade,
      valorUnitario: ctx.valorUnitCusto,
    }),
    inboundTaxRule,
    tenant.uf,
    tenant.uf,
    aliqFallback,
  );
  const { valor, valorIcms, aliqIcms } = calc;

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
      ...enderecoDestRetorno(tenant),
      valor,
      valorIcms,
      aliqIcms,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: pedido.quantidade,
      tipo: NFeTipo.RETORNO_SIMBOLICO,
      saldoDisponivel: null,
      fiscalPayload: enrichFiscalPayloadMlFulfillment(
        enrichFiscalPayloadWithXTexto(
          {
            ...enrichTaxSnapshot(taxSnapshotFromRule(inboundTaxRule, aliqFallback), {
              settings: emitterSettings,
              tipo: NFeTipo.RETORNO_SIMBOLICO,
              valor,
              valorIcms,
              emitUf: tenant.uf,
              destUf: tenant.uf,
              indFinal: 0,
            }),
            engine: calc.nota,
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
        },
      ) as Prisma.InputJsonValue,
    },
  });

  return { id: row.id, chave: row.chave };
}

/**
 * Debita remessas (FIFO) e grava `nfeReferenciaId` do retorno → remessa principal.
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

  const remessaPrincipalId = alocacoes[0]!.remessaNfeId;
  const remessa = await tx.nFe.findUniqueOrThrow({
    where: { id: remessaPrincipalId },
    select: { chave: true },
  });

  await tx.nFe.update({
    where: { id: retorno.id },
    data: { nfeReferenciaId: remessaPrincipalId },
  });

  await persistNfeXmlFromEmission(tx, {
    nfeId: retorno.id,
    tenant: pedido.tenant,
    productId: pedido.product.id,
    settings: emitterSettings,
    nfeReferenciaChave: remessa.chave,
  });

  return alocacoes;
}

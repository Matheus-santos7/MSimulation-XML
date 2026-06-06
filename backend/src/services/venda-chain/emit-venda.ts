import { enrichFiscalPayloadWithXTexto } from "@msimulation-xml/fiscal-core";
import { FiscalStatus, NFeTipo, Prisma } from "../../generated/prisma/client.js";
import { buildChaveNFe } from "../../lib/nfe-chave.js";
import { enrichTaxSnapshot } from "../../lib/fiscal-emitter-runtime.js";
import { proximoNumeroNfe } from "../../lib/nfe-sequencia.js";
import { taxSnapshotFromRule } from "../../lib/tax-snapshot.js";
import { calcularNotaFiscal } from "../../lib/tax-engine.js";
import { montarItemFiscal } from "../tax-calculation-service.js";
import { persistNfeXmlFromEmission } from "../nfe-xml-service.js";
import { enderecoDestVenda, inferAliqIcmsVenda } from "./context.js";
import type { ContextoEmissao, NotaRetornoCriada, PedidoForEmit, RegrasCadeiaVenda, VendaChainTx } from "./types.js";

export async function emitirNotaVenda(
  tx: VendaChainTx,
  pedido: PedidoForEmit,
  ctx: ContextoEmissao,
  regras: RegrasCadeiaVenda,
  retorno: NotaRetornoCriada,
) {
  const { tenant } = pedido;
  const { saleTaxRule, customerType, emitterSettings } = regras;

  const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });
  const aliqFallback = inferAliqIcmsVenda(tenant.uf, pedido.destUf);

  const itemVenda = montarItemFiscal(
    {
      codigo: pedido.product.sku ?? pedido.product.id,
      descricao: pedido.product.nome ?? "Mercadoria",
      ncm: pedido.product.ncm,
      cfop: saleTaxRule.cfop ?? pedido.product.cfop,
      unidade: pedido.product.unidade ?? "UN",
      cest: pedido.product.cest,
      ean: pedido.product.ean ?? undefined,
      exTipi: pedido.product.exTipi ?? undefined,
      origem: pedido.product.origem ?? 0,
      quantidade: pedido.quantidade,
      valorUnitario: ctx.valorUnitVenda,
    },
    saleTaxRule,
    { ufOrigem: tenant.uf, ufDestino: pedido.destUf, customerType },
    aliqFallback,
  );
  const notaVenda = calcularNotaFiscal([itemVenda]);

  const aliqIcms = itemVenda.icms.pICMS || aliqFallback;
  const valorIcms = notaVenda.totais.vICMS;
  const natOp =
    customerType === "non_taxpayer"
      ? "Venda de mercadoria para consumidor final"
      : "Venda de mercadorias";
  const cfop = saleTaxRule.cfop ?? pedido.product.cfop;

  const vendaRow = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: pedido.product.id,
      chave,
      numero,
      serie: ctx.serie,
      natOp,
      cfop,
      ncm: pedido.product.ncm,
      ...enderecoDestVenda(pedido),
      valor: ctx.valorTotalVenda,
      valorIcms,
      aliqIcms,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: pedido.quantidade,
      tipo: NFeTipo.VENDA,
      nfeReferenciaId: retorno.id,
      fiscalPayload: enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(taxSnapshotFromRule(saleTaxRule, aliqFallback), {
            settings: emitterSettings,
            tipo: NFeTipo.VENDA,
            valor: ctx.valorTotalVenda,
            valorIcms,
            emitUf: tenant.uf,
            destUf: pedido.destUf,
            indFinal: 1,
          }),
          engine: notaVenda,
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
    nfeId: vendaRow.id,
    tenant,
    productId: pedido.product.id,
    settings: emitterSettings,
    nfeReferenciaChave: retorno.chave,
  });

  return vendaRow;
}

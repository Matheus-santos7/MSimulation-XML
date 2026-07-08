import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
  resolveNumeroInicialNfe,
  type VendaMlReturnNoteDestinatario,
} from "@msimulation-xml/fiscal-core";
import { FiscalStatus, NFeTipo, Prisma, type Product, type Tenant } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../fiscal-documents/domain/services/nfe-chave.js";
import { enrichTaxSnapshot } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { proximoNumeroNfe } from "../../../fiscal-documents/domain/services/nfe-sequencia.js";
import {
  destIeRetornoFromRemessa,
  destinoRetornoFromRemessa,
  resolveRetornoSimbolicoCfop,
  RETORNO_SIMBOLICO_NAT_OP,
  type CamposDestinoRetorno,
} from "../../../remessas/domain/services/retorno-simbolico-dest.js";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import {
  buildFiscalItem,
  orderLineFromProduct,
  resolveIcmsFallbackRate,
} from "../../../tax/index.js";
import { calcularNotaFiscal } from "../../../tax/domain/services/tax-engine.js";
import {
  consumeRemessaFifoBalanceForSale,
  loadRemessaForReturnDestination,
  type PreviewRemessaFifoVenda,
} from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import { persistNfeXmlFromEmission } from "../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import type { EmissionContext } from "../../domain/entities/emission-context.entity.js";
import type { OrderForEmit, OrderItemForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { ReturnNoteCreated, SalesChainRules } from "../../application/dto/sales-chain.dto.js";
import { requirePrimaryOrderItem } from "../../domain/services/order-for-emit.helpers.js";
import { sumOrderQuantidade } from "../../domain/services/sales-chain.service.js";

/** Dados resolvidos por linha antes de emitir o retorno consolidado. */
export type ReturnLinePrep = {
  item: OrderItemForEmit;
  preview: PreviewRemessaFifoVenda;
  rules: SalesChainRules;
};

function autXmlCpfsFromSettings(
  settings: SalesChainRules["emitterSettings"],
): string[] | undefined {
  const cpfs = settings.nfe.autXmlCpfs?.filter((c) => c.replace(/\D/g, "").length === 11);
  return cpfs?.length ? cpfs : undefined;
}

/**
 * Mapeia o destinatário do retorno simbólico para o formato consumido pelo
 * `<infCpl>` da NF-e VENDA pareada. Preserva o mesmo CD operador logístico
 * (CNPJ, IE e endereço) referenciado na remessa FIFO.
 */
function destinatarioFromReturnNote(
  destino: CamposDestinoRetorno,
  destIe?: string,
): VendaMlReturnNoteDestinatario {
  return {
    xNome: destino.destNome,
    cnpj: destino.destDoc,
    ie: destIe ?? null,
    logradouro: destino.destLogradouro,
    numero: destino.destNumero,
    complemento: destino.destComplemento,
    bairro: destino.destBairro,
    municipio: destino.destMunicipio,
    codigoMunicipio: destino.destCodigoMunicipio,
    cep: destino.destCep,
    uf: destino.destUf,
    pais: destino.destNomePais,
  };
}

/**
 * Emite uma única NF-e **RETORNO_SIMBOLICO** com todos os itens do pedido (`<det>` múltiplos).
 *
 * A referência de remessa (`nfeReferenciaId`) usa a FIFO principal da primeira linha;
 * o consumo FIFO de cada SKU é vinculado depois via {@link consumeShipmentForReturn}.
 */
export async function emitConsolidatedReturnNote(
  tx: PrismaTx,
  order: OrderForEmit,
  ctx: EmissionContext,
  lines: ReturnLinePrep[],
): Promise<ReturnNoteCreated> {
  if (lines.length === 0) {
    throw new Error("Retorno consolidado exige ao menos uma linha");
  }

  const { tenant } = order;
  const primaryItem = requirePrimaryOrderItem(order);
  const primaryLine = lines[0]!;
  const { emitterSettings } = primaryLine.rules;

  const remessa = await loadRemessaForReturnDestination(tx, primaryLine.preview.remessaNfeId);
  const destUf = remessa.destUf;
  const destino = destinoRetornoFromRemessa(remessa, remessa.unidadeDestino);
  const destIe = destIeRetornoFromRemessa(remessa, remessa.unidadeDestino);
  const fallbackRate = resolveIcmsFallbackRate(tenant.uf, destUf, "inbound", emitterSettings);
  const cfop = resolveRetornoSimbolicoCfop(tenant.uf, destUf);

  const inboundFiscalItems = lines.map((line) => {
    const { inboundTaxRule } = line.rules;
    const lineFallback = resolveIcmsFallbackRate(tenant.uf, destUf, "inbound", line.rules.emitterSettings);
    return buildFiscalItem(
      orderLineFromProduct(line.item.product, {
        cfop,
        quantidade: line.item.quantidade,
        valorUnitario: Number(line.item.product.precoCusto),
      }),
      inboundTaxRule,
      {
        ufOrigem: tenant.uf,
        ufDestino: destUf,
        customerType: "taxpayer",
        operationTipo: "RETORNO_SIMBOLICO",
        emitterSettings: line.rules.emitterSettings,
      },
      lineFallback,
    );
  });

  const returnInvoice = calcularNotaFiscal(inboundFiscalItems);
  const valor = returnInvoice.totais.vNF;
  const valorIcms = returnInvoice.totais.vICMS;
  const aliqIcms = inboundFiscalItems[0]?.icms.pICMS ?? fallbackRate;
  const quantidadeTotal = sumOrderQuantidade(order);

  const numeroInicial = resolveNumeroInicialNfe(emitterSettings, ctx.serie, {
    serieRemessa: tenant.serieRemessa,
    serieTransferencia: tenant.serieRemessa,
  });
  const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie, numeroInicial);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });

  const idCadIntTran = remessa.unidadeDestino?.idCadIntTran?.trim() || undefined;
  const autXmlCpfs = autXmlCpfsFromSettings(emitterSettings);
  const primaryExTipi = primaryItem.product.exTipi?.trim();

  const row = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: primaryItem.product.id,
      chave,
      numero,
      serie: ctx.serie,
      natOp: RETORNO_SIMBOLICO_NAT_OP,
      cfop,
      ncm: primaryItem.product.ncm,
      ...destino,
      valor,
      valorIcms,
      aliqIcms,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: quantidadeTotal,
      tipo: NFeTipo.RETORNO_SIMBOLICO,
      saldoDisponivel: null,
      nfeReferenciaId: remessa.id,
      fiscalPayload: enrichFiscalPayloadMlFulfillment(
        enrichFiscalPayloadWithXTexto(
          {
            ...enrichTaxSnapshot(
              taxSnapshotFromRule(primaryLine.rules.inboundTaxRule, fallbackRate, emitterSettings),
              {
                settings: emitterSettings,
                tipo: NFeTipo.RETORNO_SIMBOLICO,
                valor,
                valorIcms,
                emitUf: tenant.uf,
                destUf,
                indFinal: 0,
              },
            ),
            engine: returnInvoice,
            ...(destIe ? { destIe } : {}),
            ...(primaryExTipi ? { exTipi: primaryExTipi } : {}),
          } as Record<string, unknown>,
          {
            tipo: NFeTipo.RETORNO_SIMBOLICO,
            cfop,
            natOp: RETORNO_SIMBOLICO_NAT_OP,
            pedidoMl: ctx.pedidoMl,
          },
        ),
        {
          quantidadeTotal,
          withLogistics: false,
          destIe,
          idCadIntTran,
          autXmlCpfs,
        },
      ) as Prisma.InputJsonValue,
    },
  });

  return {
    id: row.id,
    chave: row.chave,
    remessaChave: primaryLine.preview.remessaChave,
    numero: row.numero,
    serie: row.serie,
    emitidaEm: row.emitidaEm,
    destinatario: destinatarioFromReturnNote(destino, destIe),
  };
}

/**
 * Debita saldo FIFO da remessa e associa consumos ao retorno simbólico consolidado.
 */
export async function consumeShipmentForReturn(
  tx: PrismaTx,
  order: OrderForEmit,
  item: OrderItemForEmit,
  returnNoteId: string,
) {
  return consumeRemessaFifoBalanceForSale(
    tx,
    order.tenant.id,
    item.product.id,
    item.quantidade,
    returnNoteId,
    order.destUf,
    item.product.sku,
  );
}

/**
 * Persiste o XML autorizado do retorno consolidado com todos os produtos do pedido.
 */
export async function persistConsolidatedReturnXml(
  tx: PrismaTx,
  returnNote: ReturnNoteCreated,
  order: OrderForEmit,
  emitterSettings: SalesChainRules["emitterSettings"],
) {
  const primaryItem = requirePrimaryOrderItem(order);
  await persistNfeXmlFromEmission(tx, {
    nfeId: returnNote.id,
    tenant: order.tenant as Tenant,
    productId: primaryItem.product.id,
    products: order.items.map((line) => line.product as Product),
    settings: emitterSettings,
    nfeReferenciaChave: returnNote.remessaChave,
  });
}

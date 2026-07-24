import {
  assertCestRequiredForStCfop,
  assertTaxRuleCfopMatchesTree,
  enrichFiscalPayloadMlVenda,
  enrichFiscalPayloadWithXTexto,
  resolveFiscalExitUf,
  resolveNumeroInicialNfe,
  resolveSaleCfop,
  resolveUniformProdutoSt,
  SaleCfopConsistencyError,
  saleRoutingFromEmitterSettings,
  VENDA_ML_NAT_OP,
} from "@msimulation-xml/fiscal-core";
import { FiscalStatus, NFeTipo, Prisma, type Product, type Tenant } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../fiscal-documents/domain/services/nfe-chave.js";
import { enrichTaxSnapshot } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { proximoNumeroNfe } from "../../../fiscal-documents/domain/services/nfe-sequencia.js";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import { calcularNotaFiscal } from "../../../tax/domain/services/tax-engine.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { buildFiscalItem, resolveTaxRule } from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import type { EmissionContext } from "../../domain/entities/emission-context.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { ReturnNoteCreated, SalesChainRules } from "../../application/dto/sales-chain.dto.js";
import { requirePrimaryOrderItem } from "../../domain/services/order-for-emit.helpers.js";
import {
  inferIcmsRateForSale,
  requireTaxRule,
  resolveDestIeForFiscalPayload,
  saleDestinationAddress,
  sumOrderQuantidade,
} from "../../domain/services/sales-chain.service.js";
import { SalesChainError } from "../../domain/errors/sales-chain.error.js";
import { resolveSaleItemXPeds } from "../../domain/services/sale-item-xpeds.js";

function autXmlCpfsFromSettings(
  settings: SalesChainRules["emitterSettings"],
): string[] | undefined {
  const cpfs = settings.nfe.autXmlCpfs?.filter((c) => c.replace(/\D/g, "").length === 11);
  return cpfs?.length ? cpfs : undefined;
}

/**
 * Emite NF-e **VENDA** ao comprador final, referenciando o retorno simbólico principal.
 *
 * Suporta múltiplos itens (`<det>`) com regra fiscal e frete/desconto por linha.
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
  const { customerType, emitterSettings } = rules;
  const fiscalExitUf = resolveFiscalExitUf(tenant.uf, stockUf);
  const primaryItem = requirePrimaryOrderItem(order);

  const numeroInicial = resolveNumeroInicialNfe(emitterSettings, ctx.serie, {
    serieRemessa: tenant.serieRemessa,
    serieTransferencia: tenant.serieRemessa,
  });
  const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie, numeroInicial);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie: ctx.serie, numero });
  const fallbackRate = inferIcmsRateForSale(fiscalExitUf, order.destUf, emitterSettings);
  const natOp = VENDA_ML_NAT_OP;
  const packXPed = order.mlPackId?.trim() || ctx.pedidoMl;
  const xPeds = resolveSaleItemXPeds(order.items, packXPed);
  const xPed = xPeds[0] || packXPed;
  const autXmlCpfs = autXmlCpfsFromSettings(emitterSettings);
  const nfci = primaryItem.product.nfci?.trim() || undefined;

  const saleFiscalItems = [];
  const orderFreteConsumidor = order.valorFreteConsumidor ?? 0;

  let produtoSt: boolean;
  try {
    produtoSt = resolveUniformProdutoSt(order.items.map((i) => i.product.sujeitoSt === true));
  } catch (error) {
    if (error instanceof SaleCfopConsistencyError) {
      throw new SalesChainError(error.message);
    }
    throw error;
  }

  const saleRouting = saleRoutingFromEmitterSettings(emitterSettings, { produtoSt });
  const cfop = resolveSaleCfop(tenant.uf, order.destUf, customerType, null, saleRouting);
  try {
    assertCestRequiredForStCfop(
      cfop,
      order.items.map((i) => ({ cest: i.product.cest, sku: i.product.sku })),
    );
  } catch (error) {
    if (error instanceof SaleCfopConsistencyError) {
      throw new SalesChainError(error.message);
    }
    throw error;
  }

  for (const [index, item] of order.items.entries()) {
    const ruleBaseId = item.product.taxRuleBaseId?.trim() ?? ctx.ruleBaseId;
    const saleTaxRule = requireTaxRule(
      await resolveTaxRule(tx, tenant.id, {
        originUf: tenant.uf,
        destinationUf: order.destUf,
        transactionType: "sale",
        customerType,
        ruleBaseId,
      }),
      {
        label: "venda",
        ruleBaseId,
        originUf: tenant.uf,
        destinationUf: order.destUf,
        customerType,
      },
    );
    try {
      assertTaxRuleCfopMatchesTree(cfop, saleTaxRule.cfop, tenant.uf, order.destUf);
    } catch (error) {
      if (error instanceof SaleCfopConsistencyError) {
        throw new SalesChainError(error.message);
      }
      throw error;
    }
    const valorFrete = index === 0 ? orderFreteConsumidor : 0;
    const valorDesconto = item.valorDesconto ?? 0;

    saleFiscalItems.push(
      buildFiscalItem(
        {
          codigo: item.product.sku ?? item.product.id,
          descricao: item.product.nome ?? "Mercadoria",
          ncm: item.product.ncm,
          cfop,
          unidade: item.product.unidade ?? "UN",
          cest: item.product.cest ?? undefined,
          ean: item.product.ean ?? undefined,
          exTipi: item.product.exTipi ?? undefined,
          origem: item.product.origem ?? 0,
          quantidade: item.quantidade,
          valorUnitario: Number(item.product.preco),
          frete: valorFrete,
          desconto: valorDesconto,
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
      ),
    );
  }

  const saleInvoice = calcularNotaFiscal(saleFiscalItems);
  const icmsRate = saleFiscalItems[0]?.icms.pICMS || fallbackRate;
  const icmsValue = saleInvoice.totais.vICMS;
  const valorFreteTotal = saleInvoice.totais.vFrete;
  const valorDescontoTotal = saleInvoice.totais.vDesc;
  const quantidadeTotal = sumOrderQuantidade(order);
  const crossUfFulfillment = fiscalExitUf.toUpperCase() !== tenant.uf.toUpperCase();
  const cMunSaidaFisica = stockCodigoMunicipio?.trim() || undefined;
  const destIe = resolveDestIeForFiscalPayload(order.destIndIeDest, order.destIe);

  const saleRow = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: primaryItem.product.id,
      chave,
      numero,
      serie: ctx.serie,
      natOp,
      cfop,
      ncm: primaryItem.product.ncm,
      ...saleDestinationAddress(order),
      valor: saleInvoice.totais.vNF,
      valorIcms: icmsValue,
      aliqIcms: icmsRate,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: ctx.emitidaEm,
      pedidoMl: ctx.pedidoMl,
      quantidade: quantidadeTotal,
      tipo: NFeTipo.VENDA,
      nfeReferenciaId: returnNote.id,
      fiscalPayload: enrichFiscalPayloadWithXTexto(
        enrichFiscalPayloadMlVenda(
          {
            ...enrichTaxSnapshot(
              taxSnapshotFromRule(rules.saleTaxRule, fallbackRate, emitterSettings),
              {
                settings: emitterSettings,
                tipo: NFeTipo.VENDA,
                valor: saleInvoice.totais.vNF,
                valorIcms: icmsValue,
                emitUf: fiscalExitUf,
                destUf: order.destUf,
                indFinal: 1,
              },
            ),
            engine: saleInvoice,
            ufSaidaFisica: fiscalExitUf,
            ...(crossUfFulfillment && cMunSaidaFisica ? { cMunSaidaFisica } : {}),
            ...(autXmlCpfs ? { autXmlCpfs } : {}),
            ...(nfci ? { nfci } : {}),
            ...(xPed ? { xPed } : {}),
            ...(xPeds.length > 0 ? { xPeds } : {}),
            ...(valorFreteTotal > 0 ? { valorFrete: valorFreteTotal } : {}),
            ...(valorDescontoTotal > 0 ? { valorDesconto: valorDescontoTotal } : {}),
            ...(destIe ? { destIe } : {}),
          } as Record<string, unknown>,
          {
            quantidade: quantidadeTotal,
            valorFrete: valorFreteTotal,
            xPed,
            nfci,
            autXmlCpfs,
            returnNote: {
              numero: returnNote.numero,
              serie: returnNote.serie,
              emitidaEm: returnNote.emitidaEm,
              destinatario: returnNote.destinatario,
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
    productId: primaryItem.product.id,
    products: order.items.map((item) => item.product as Product),
    settings: emitterSettings,
    nfeReferenciaChave: returnNote.chave,
  });

  return saleRow;
}

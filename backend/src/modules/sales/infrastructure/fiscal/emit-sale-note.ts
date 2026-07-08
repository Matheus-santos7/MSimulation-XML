import {
  enrichFiscalPayloadMlVenda,
  enrichFiscalPayloadWithXTexto,
  resolveFiscalExitUf,
  resolveNumeroInicialNfe,
  resolveSaleCfop,
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
  const xPed = order.mlPackId?.trim() || ctx.pedidoMl;
  const autXmlCpfs = autXmlCpfsFromSettings(emitterSettings);
  const nfci = primaryItem.product.nfci?.trim() || undefined;

  const saleFiscalItems = [];
  let headerCfop = rules.saleTaxRule.cfop;
  const orderFreteConsumidor = order.valorFreteConsumidor ?? 0;

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
    headerCfop = saleTaxRule.cfop;
    const cfop = resolveSaleCfop(tenant.uf, order.destUf, customerType, saleTaxRule.cfop);
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
  const cfop = resolveSaleCfop(tenant.uf, order.destUf, customerType, headerCfop);

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

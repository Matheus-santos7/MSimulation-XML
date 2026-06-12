/**
 * Tax calculation bridge between stored fiscal rules and the pure tax engine.
 * No Prisma dependency — arithmetic is delegated to `tax-engine`.
 */

import {
  calcularNotaFiscal,
  type ItemFiscalInput,
  type NotaFiscalResult,
} from "../../../../lib/fiscal/tax-engine.js";
import { taxSnapshotFromRule } from "../../../../lib/fiscal/tax-snapshot.js";
import type { FiscalContext } from "../../domain/entities/fiscal-context.entity.js";
import type { OrderLine } from "../../domain/entities/order-line.entity.js";
import type { ProductFiscalLine } from "../../domain/entities/product-fiscal-line.entity.js";
import type { ResolvedTaxRule } from "../../domain/entities/resolved-tax-rule.entity.js";

export type InboundInvoiceResult = {
  nota: NotaFiscalResult;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  cfop: string;
};

export function inferIcmsRateForShipment(emitUf: string, destUf: string): number {
  if (emitUf.toUpperCase() === destUf.toUpperCase()) return 18;
  return 4;
}

export function inferIntraStateIcmsRate(emitUf: string, destUf: string): number {
  if (emitUf.toUpperCase() === destUf.toUpperCase()) return 18;
  return defaultInterstateIcmsRate(emitUf, destUf);
}

export function orderLineFromProduct(
  product: ProductFiscalLine,
  opts: { cfop: string; quantidade: number; valorUnitario: number },
): OrderLine {
  return {
    codigo: product.sku ?? product.id,
    descricao: product.nome ?? "Mercadoria",
    ncm: product.ncm,
    cfop: opts.cfop,
    unidade: product.unidade ?? "UN",
    cest: product.cest ?? undefined,
    ean: product.ean ?? undefined,
    exTipi: product.exTipi ?? undefined,
    origem: product.origem ?? 0,
    quantidade: opts.quantidade,
    valorUnitario: opts.valorUnitario,
  };
}

export function calculateInboundInvoice(
  line: OrderLine,
  rule: ResolvedTaxRule,
  originUf: string,
  destinationUf: string,
  fallbackIcmsRate: number,
): InboundInvoiceResult {
  const item = buildFiscalItem(
    line,
    rule,
    { ufOrigem: originUf, ufDestino: destinationUf, customerType: "taxpayer" },
    fallbackIcmsRate,
  );
  const nota = calcularNotaFiscal([item]);
  return {
    nota,
    valor: nota.totais.vNF,
    valorIcms: nota.totais.vICMS,
    aliqIcms: item.icms.pICMS,
    cfop: line.cfop,
  };
}

function resolveInterstateIcmsRate(
  rule: ResolvedTaxRule | null,
  snapshot: ReturnType<typeof taxSnapshotFromRule>,
  ctx: FiscalContext,
  fallbackIcmsRate: number,
  internalRate: number,
): number {
  if (rule != null) {
    if (rule.icms?.pIcmsInterstate != null) return rule.icms.pIcmsInterstate;
    if (rule.aliquotaIcmsInterna != null) return rule.aliquotaIcmsInterna;
    return fallbackIcmsRate;
  }
  return (
    snapshot.icms.pIcmsInterstate ??
    defaultInterstateIcmsRate(ctx.ufOrigem, ctx.ufDestino) ??
    internalRate
  );
}

function defaultInterstateIcmsRate(originUf: string, destinationUf: string): number {
  const o = originUf.toUpperCase();
  const d = destinationUf.toUpperCase();
  if (o === d) return 0;
  const southSoutheast = new Set(["SP", "RJ", "MG", "PR", "SC", "RS"]);
  const northNortheastCenterWestEs = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "ES", "GO", "MA", "MT", "MS",
    "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO", "DF",
  ]);
  if (southSoutheast.has(o) && northNortheastCenterWestEs.has(d)) return 7;
  return 12;
}

export function buildFiscalItem(
  line: OrderLine,
  rule: ResolvedTaxRule | null,
  ctx: FiscalContext,
  fallbackIcmsRate: number,
): ItemFiscalInput {
  const snapshot = taxSnapshotFromRule(rule, fallbackIcmsRate);

  const isInterstate = ctx.ufOrigem.toUpperCase() !== ctx.ufDestino.toUpperCase();
  const isFinalConsumer = ctx.customerType === "non_taxpayer";
  const appliesDifal = isInterstate && isFinalConsumer;

  const internalRate = snapshot.icms.aliquota;
  const icmsRate = isInterstate
    ? resolveInterstateIcmsRate(rule, snapshot, ctx, fallbackIcmsRate, internalRate)
    : internalRate;

  return {
    numeroItem: line.numeroItem ?? 1,
    codigo: line.codigo,
    descricao: line.descricao,
    ncm: line.ncm,
    cfop: line.cfop,
    unidade: line.unidade,
    cest: line.cest,
    ean: line.ean,
    exTipi: line.exTipi,
    quantidade: line.quantidade,
    valorUnitario: line.valorUnitario,
    frete: line.frete,
    seguro: line.seguro,
    despesasAcessorias: line.despesasAcessorias,
    desconto: line.desconto,
    icms: {
      cst: snapshot.icms.cst,
      orig: line.origem,
      pICMS: icmsRate,
      modBC: 3,
      pRedBC: snapshot.icms.pRedBc,
      pFCP: snapshot.icms.pIcmsFcp,
    },
    ipi:
      rule != null || snapshot.ipi.aliquota > 0
        ? {
            cst: String(snapshot.ipi.st).slice(0, 2),
            pIPI: snapshot.ipi.aliquota,
            cEnq: snapshot.ipi.codEnq,
          }
        : undefined,
    pis: {
      cst: String(snapshot.pis.st).slice(0, 2),
      aliquota: snapshot.pis.aliquota,
    },
    cofins: {
      cst: String(snapshot.cofins.st).slice(0, 2),
      aliquota: snapshot.cofins.aliquota,
    },
    difal: appliesDifal
      ? {
          pICMSInter: icmsRate,
          pICMSUFDest: internalRate,
          pFCPUFDest: snapshot.icms.pIcmsFcp,
          pRedBC: snapshot.icms.pRedBcDifal,
        }
      : undefined,
    incluirIpiNaBaseIcms: isFinalConsumer,
  };
}

export function calculateInvoiceTaxes(
  lines: { line: OrderLine; rule: ResolvedTaxRule | null }[],
  ctx: FiscalContext,
  fallbackIcmsRate: number,
): NotaFiscalResult {
  const items = lines.map(({ line, rule }, i) =>
    buildFiscalItem(
      { ...line, numeroItem: line.numeroItem ?? i + 1 },
      rule,
      ctx,
      fallbackIcmsRate,
    ),
  );
  return calcularNotaFiscal(items);
}

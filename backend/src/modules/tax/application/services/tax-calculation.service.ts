/**
 * Ponte entre regras fiscais persistidas e o motor puro {@link calcularNotaFiscal}.
 *
 * Responsabilidades deste serviço (camada application do módulo tax):
 * - Resolver alíquotas ICMS intra/interestadual a partir da {@link ResolvedTaxRule}
 * - Montar {@link ItemFiscalInput} com ICMS, IPI, PIS/COFINS e DIFAL
 * - Delegar aritmética de item e totais ao `tax-engine` de domínio (sem Prisma)
 *
 * Consumidores: **sales** (venda), **remessas** (remessa/inbound), testes e API interna.
 */

import {
  calcularNotaFiscal,
  type ItemFiscalInput,
  type NotaFiscalResult,
} from "../../domain/services/tax-engine.js";
import { taxSnapshotFromRule } from "../../domain/services/tax-snapshot.js";
import type {
  FiscalContext,
  FiscalOperationTipo,
} from "../../domain/entities/fiscal-context.entity.js";
import type { OrderLine } from "../../domain/entities/order-line.entity.js";
import type { ProductFiscalLine } from "../../domain/entities/product-fiscal-line.entity.js";
import type { ResolvedTaxRule } from "../../domain/entities/resolved-tax-rule.entity.js";
import {
  composicaoChannel,
  mapCstDevolucao,
  resolveIpiCstFromSnapshot,
  resolvePisCofinsCstFromSnapshot,
  resolveDifalMode,
  type FiscalEmitterSettingsData,
} from "@msimulation-xml/fiscal-core";
import {
  defaultInterstateConvenioRate,
  inferIcmsRateForShipment,
  inferIntraStateIcmsRate,
} from "./tax-fallback-resolver.service.js";

export {
  defaultInterstateConvenioRate,
  inferIcmsRateForSale,
  inferIcmsRateForShipment,
  inferIntraStateIcmsRate,
  resolveIcmsFallbackRate,
  resolveInterstateSaleFallbackRate,
  resolvePisCofinsFallbackRates,
} from "./tax-fallback-resolver.service.js";

/** Contexto estendido: regras da planilha + fallback das configurações do emissor. */
export type BuildFiscalItemContext = FiscalContext & {
  emitterSettings?: FiscalEmitterSettingsData | null;
};

const ICMS_CST_NAO_TRIBUTADO = new Set(["40", "41", "50", "60"]);

/** Resultado simplificado de nota inbound (retorno simbólico / remessa). */
export type InboundInvoiceResult = {
  nota: NotaFiscalResult;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  cfop: string;
};

export type CalculateInboundInvoiceOptions = {
  operationTipo?: FiscalOperationTipo;
  emitterSettings?: FiscalEmitterSettingsData | null;
};

/**
 * Converte produto do catálogo em linha fiscal para cálculo.
 *
 * @param product - SKU, NCM, CEST, origem, etc.
 * @param opts - CFOP resolvido, quantidade e valor unitário da operação
 */
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

/**
 * Calcula impostos de uma nota **inbound** (retorno simbólico, remessa simbólica).
 *
 * Força `customerType: taxpayer` no contexto fiscal (B2B para CD).
 *
 * @param line - Item com CFOP e valores
 * @param rule - Regra resolvida (inbound)
 * @param originUf - UF origem da operação
 * @param destinationUf - UF destino (CD)
 * @param fallbackIcmsRate - Alíquota se a regra não especificar
 */
export function calculateInboundInvoice(
  line: OrderLine,
  rule: ResolvedTaxRule,
  originUf: string,
  destinationUf: string,
  fallbackIcmsRate: number,
  options?: CalculateInboundInvoiceOptions,
): InboundInvoiceResult {
  const item = buildFiscalItem(
    line,
    rule,
    {
      ufOrigem: originUf,
      ufDestino: destinationUf,
      customerType: "taxpayer",
      operationTipo: options?.operationTipo,
      emitterSettings: options?.emitterSettings,
    },
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

/**
 * Escolhe alíquota ICMS interestadual efetiva a aplicar no item.
 *
 * Prioridade: `pIcmsInterstate` → `aliquotaIcmsInterna` → fallback → snapshot.
 */
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
    defaultInterstateConvenioRate(ctx.ufOrigem, ctx.ufDestino) ??
    internalRate
  );
}

function toOptionalNum(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function taxPayloadRedBc(rule: ResolvedTaxRule | null, tax: "pis" | "cofins"): number | undefined {
  const taxes = (rule?.payload?.taxes as Record<string, unknown> | undefined) ?? {};
  const block = (taxes[tax] as Record<string, unknown> | undefined) ?? {};
  return toOptionalNum(block.pRedBc ?? block.pRedBC);
}

function resolveIcmsCst(snapshotCst: string, ctx: BuildFiscalItemContext): string {
  const emitterSettings = ctx.emitterSettings;
  if (
    ctx.operationTipo === "DEVOLUCAO" &&
    emitterSettings &&
    emitterSettings.taxes.cstDevolucao.mode !== "DEFAULT" &&
    ctx.cstVendaReferencia?.icms
  ) {
    return mapCstDevolucao(
      ctx.cstVendaReferencia.icms,
      emitterSettings.taxes.cstDevolucao.icms,
    );
  }
  return snapshotCst;
}

function resolvePisCofinsCst(
  snapshotSt: string,
  ctx: BuildFiscalItemContext,
  tax: "pis" | "cofins",
): string {
  const emitterSettings = ctx.emitterSettings;
  if (
    ctx.operationTipo === "DEVOLUCAO" &&
    emitterSettings &&
    emitterSettings.taxes.cstDevolucao.mode !== "DEFAULT"
  ) {
    const ref = tax === "pis" ? ctx.cstVendaReferencia?.pis : ctx.cstVendaReferencia?.cofins;
    if (ref) {
      return mapCstDevolucao(ref, emitterSettings.taxes.cstDevolucao.pisCofins);
    }
  }
  return resolvePisCofinsCstFromSnapshot(snapshotSt, ctx.operationTipo);
}

function shouldIncludeIpiInIcmsBase(ctx: BuildFiscalItemContext, isFinalConsumer: boolean): boolean {
  const settings = ctx.emitterSettings;
  if (!settings) return isFinalConsumer;

  const channel = composicaoChannel((ctx.operationTipo ?? "VENDA") as FiscalOperationTipo);
  const ipiAction = settings.taxes.composicaoBaseCalculo.icms.ipi?.[channel];
  if (ipiAction === "INCLUIR_NA_BASE") return true;
  if (ipiAction === "NAO_INCLUIR") return false;
  return isFinalConsumer;
}

function shouldApplyDifal(ctx: BuildFiscalItemContext, isInterstate: boolean, isFinalConsumer: boolean): boolean {
  if (!isInterstate || !isFinalConsumer) return false;
  const mode = ctx.emitterSettings
    ? resolveDifalMode(ctx.emitterSettings, ctx.ufDestino)
    : "PADRAO";
  return mode !== "SEM_DIFAL";
}

/**
 * Monta um {@link ItemFiscalInput} pronto para o tax-engine.
 *
 * Algoritmo de decisão:
 * 1. `taxSnapshotFromRule` extrai CST, PIS, COFINS, IPI do payload
 * 2. Detecta interestadual e consumidor final (`non_taxpayer`)
 * 3. Escolhe `pICMS` intra vs interestadual
 * 4. Ativa bloco DIFAL se interestadual + consumidor final
 * 5. `incluirIpiNaBaseIcms` quando consumidor final (regra ML Full)
 *
 * @param line - Linha comercial (produto × quantidade × valor)
 * @param rule - Regra resolvida ou `null` (usa só snapshot/fallback)
 * @param ctx - UF origem/destino e tipo de cliente
 * @param fallbackIcmsRate - Alíquota ICMS de reserva
 */
export function buildFiscalItem(
  line: OrderLine,
  rule: ResolvedTaxRule | null,
  ctx: BuildFiscalItemContext,
  fallbackIcmsRate: number,
): ItemFiscalInput {
  const snapshot = taxSnapshotFromRule(rule, fallbackIcmsRate, ctx.emitterSettings);

  const isInterstate = ctx.ufOrigem.toUpperCase() !== ctx.ufDestino.toUpperCase();
  const isFinalConsumer = ctx.customerType === "non_taxpayer";
  const appliesDifal = shouldApplyDifal(ctx, isInterstate, isFinalConsumer);

  const internalRate = snapshot.icms.aliquota;
  const icmsRate = isInterstate
    ? resolveInterstateIcmsRate(rule, snapshot, ctx, fallbackIcmsRate, internalRate)
    : internalRate;

  const icmsCst = resolveIcmsCst(snapshot.icms.cst, ctx);
  const effectivePIcms = ICMS_CST_NAO_TRIBUTADO.has(icmsCst) ? 0 : icmsRate;

  const pisCst = resolvePisCofinsCst(snapshot.pis.st, ctx, "pis");
  const cofinsCst = resolvePisCofinsCst(snapshot.cofins.st, ctx, "cofins");
  const pisRedBc = taxPayloadRedBc(rule, "pis");
  const cofinsRedBc = taxPayloadRedBc(rule, "cofins");

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
      cst: icmsCst,
      orig: line.origem,
      pICMS: effectivePIcms,
      modBC: 3,
      pRedBC: snapshot.icms.pRedBc,
      pFCP: snapshot.icms.pIcmsFcp,
    },
    ipi:
      rule != null || snapshot.ipi.aliquota > 0
        ? {
            cst: resolveIpiCstFromSnapshot(String(snapshot.ipi.st), ctx.operationTipo),
            pIPI: snapshot.ipi.aliquota,
            cEnq: snapshot.ipi.codEnq,
          }
        : undefined,
    pis: {
      cst: pisCst,
      aliquota: snapshot.pis.aliquota,
      ...(pisRedBc != null ? { pRedBC: pisRedBc } : {}),
    },
    cofins: {
      cst: cofinsCst,
      aliquota: snapshot.cofins.aliquota,
      ...(cofinsRedBc != null ? { pRedBC: cofinsRedBc } : {}),
    },
    difal: appliesDifal
      ? {
          pICMSInter: icmsRate,
          pICMSUFDest: internalRate,
          pFCPUFDest: snapshot.icms.pIcmsFcp,
          pRedBC: snapshot.icms.pRedBcDifal,
        }
      : undefined,
    incluirIpiNaBaseIcms: shouldIncludeIpiInIcmsBase(ctx, isFinalConsumer),
  };
}

/**
 * Calcula impostos de nota com múltiplos itens (venda ao consumidor).
 *
 * @param lines - Pares linha + regra resolvida por item
 * @param ctx - Contexto fiscal (UFs e tipo de cliente)
 * @param fallbackIcmsRate - Alíquota ICMS de reserva
 * @returns Totais e itens calculados pelo tax-engine
 */
export function calculateInvoiceTaxes(
  lines: { line: OrderLine; rule: ResolvedTaxRule | null }[],
  ctx: BuildFiscalItemContext,
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

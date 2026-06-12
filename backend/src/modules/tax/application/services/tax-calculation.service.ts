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
import type { FiscalContext } from "../../domain/entities/fiscal-context.entity.js";
import type { OrderLine } from "../../domain/entities/order-line.entity.js";
import type { ProductFiscalLine } from "../../domain/entities/product-fiscal-line.entity.js";
import type { ResolvedTaxRule } from "../../domain/entities/resolved-tax-rule.entity.js";

/** Resultado simplificado de nota inbound (retorno simbólico / remessa). */
export type InboundInvoiceResult = {
  nota: NotaFiscalResult;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  cfop: string;
};

/**
 * Alíquota ICMS fallback para **remessas** interestaduais (4%) vs intra (18%).
 *
 * @param emitUf - UF do emitente
 * @param destUf - UF do destinatário (CD)
 */
export function inferIcmsRateForShipment(emitUf: string, destUf: string): number {
  if (emitUf.toUpperCase() === destUf.toUpperCase()) return 18;
  return 4;
}

/**
 * Alíquota ICMS fallback para operações com tabela interestadual padrão (7/12/18).
 *
 * @see defaultInterstateIcmsRate
 */
export function inferIntraStateIcmsRate(emitUf: string, destUf: string): number {
  if (emitUf.toUpperCase() === destUf.toUpperCase()) return 18;
  return defaultInterstateIcmsRate(emitUf, destUf);
}

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
    defaultInterstateIcmsRate(ctx.ufOrigem, ctx.ufDestino) ??
    internalRate
  );
}

/**
 * Tabela simplificada de alíquota interestadual (Convênio ICMS).
 *
 * - Mesma UF → 0 (caller trata intra separadamente)
 * - Sul/Sudeste → N/NE/CO/ES → 7%
 * - Demais → 12%
 */
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

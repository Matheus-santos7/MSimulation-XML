/**
 * Serviço de Cálculo Tributário — ponte entre as regras fiscais armazenadas
 * (tabela `tax_rules`, resolvidas por `resolveTaxRule`) e a engine matemática
 * pura (`tax-engine`).
 *
 * Responsabilidade desta camada (alta coesão):
 *  - Decidir QUAL alíquota entra em cada bloco do XML conforme a operação:
 *      • intraestadual            → ICMS próprio pela alíquota interna;
 *      • interestadual + consumidor final (não contribuinte) → ICMS próprio
 *        pela alíquota interestadual + partilha DIFAL (ICMSUFDest);
 *      • interestadual + contribuinte → ICMS próprio interestadual, sem DIFAL.
 *  - Definir se o IPI integra a base do ICMS (consumidor final).
 *  - Montar os itens de entrada e delegar TODA a aritmética para a engine.
 *
 * A engine não conhece Prisma; este serviço não faz aritmética de imposto.
 */

import type { ResolvedTaxRule } from "./tax-rule-service.js";
import type { CustomerType } from "../../../lib/fiscal/tax-rule-ids.js";
import { taxSnapshotFromRule } from "../../../lib/fiscal/tax-snapshot.js";
import {
  calcularNotaFiscal,
  type ItemFiscalInput,
  type NotaFiscalResult,
} from "../../../lib/fiscal/tax-engine.js";

export type LinhaPedido = {
  numeroItem?: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  cest?: string;
  ean?: string;
  exTipi?: string;
  origem: number;
  quantidade: number;
  valorUnitario: number;
  frete?: number;
  seguro?: number;
  despesasAcessorias?: number;
  desconto?: number;
};

export type ContextoFiscal = {
  ufOrigem: string;
  ufDestino: string;
  customerType: CustomerType;
};

export type ProdutoLinhaFiscal = {
  id: string;
  sku?: string | null;
  nome?: string | null;
  ncm: string;
  cest?: string | null;
  ean?: string | null;
  exTipi?: string | null;
  unidade?: string | null;
  origem?: number | null;
};

export type ResultadoNotaInbound = {
  nota: NotaFiscalResult;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  cfop: string;
};

/**
 * Fallback ICMS quando a planilha não traz alíquota para a UF destino.
 * Usado em `emitirNFeRemessaComItens` antes de `calcularImpostosNota`.
 */
export function inferAliqIcmsRemessa(emitUf: string, destUf: string): number {
  if (emitUf.toUpperCase() === destUf.toUpperCase()) return 18;
  return 4;
}

/** Fallback ICMS intraestadual (retorno simbólico emitente→emitente). */
export function inferAliqIcmsIntraestadual(emitUf: string, destUf: string): number {
  if (emitUf.toUpperCase() === destUf.toUpperCase()) return 18;
  return aliquotaInterestadualPadrao(emitUf, destUf);
}

/** Monta linha de item da remessa a partir do cadastro de produto + CFOP/qtd/valor. */
export function linhaPedidoFromProduto(
  product: ProdutoLinhaFiscal,
  opts: { cfop: string; quantidade: number; valorUnitario: number },
): LinhaPedido {
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
 * Calcula NF-e inbound (remessa física ou retorno simbólico): B2B contribuinte via engine.
 */
export function calcularNotaInbound(
  linha: LinhaPedido,
  rule: ResolvedTaxRule,
  ufOrigem: string,
  ufDestino: string,
  fallbackAliqIcms: number,
): ResultadoNotaInbound {
  const item = montarItemFiscal(
    linha,
    rule,
    { ufOrigem, ufDestino, customerType: "taxpayer" },
    fallbackAliqIcms,
  );
  const nota = calcularNotaFiscal([item]);
  return {
    nota,
    valor: nota.totais.vNF,
    valorIcms: nota.totais.vICMS,
    aliqIcms: item.icms.pICMS,
    cfop: linha.cfop,
  };
}

/**
 * ICMS próprio em operação interestadual.
 * Com regra da planilha: respeita 0% explícito (envio de estoque / inbound ML).
 * Sem regra: usa padrão legal (12% / 7%) para vendas B2B.
 */
function resolveAliqIcmsInterestadual(
  rule: ResolvedTaxRule | null,
  snapshot: ReturnType<typeof taxSnapshotFromRule>,
  ctx: ContextoFiscal,
  fallbackAliqIcms: number,
  pInterna: number,
): number {
  if (rule != null) {
    if (rule.icms?.pIcmsInterstate != null) return rule.icms.pIcmsInterstate;
    if (rule.aliquotaIcmsInterna != null) return rule.aliquotaIcmsInterna;
    return fallbackAliqIcms;
  }
  return (
    snapshot.icms.pIcmsInterstate ??
    aliquotaInterestadualPadrao(ctx.ufOrigem, ctx.ufDestino) ??
    pInterna
  );
}

/** Alíquota interestadual padrão por UF de origem (Sul/Sudeste exceto ES = 12; demais = 7). */
function aliquotaInterestadualPadrao(ufOrigem: string, ufDestino: string): number {
  const o = ufOrigem.toUpperCase();
  const d = ufDestino.toUpperCase();
  if (o === d) return 0;
  const sulSudeste = new Set(["SP", "RJ", "MG", "PR", "SC", "RS"]);
  // Origem Sul/Sudeste → destino Norte/Nordeste/CO/ES usa 7%; caso geral 12%.
  const norteNordesteCoEs = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "ES", "GO", "MA", "MT", "MS",
    "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO", "DF",
  ]);
  if (sulSudeste.has(o) && norteNordesteCoEs.has(d)) return 7;
  return 12;
}

/**
 * Monta a entrada de um item da engine a partir de uma linha do pedido + a
 * regra fiscal resolvida (origem × destino já considerados em `resolveTaxRule`).
 */
export function montarItemFiscal(
  linha: LinhaPedido,
  rule: ResolvedTaxRule | null,
  ctx: ContextoFiscal,
  fallbackAliqIcms: number,
): ItemFiscalInput {
  const snapshot = taxSnapshotFromRule(rule, fallbackAliqIcms);

  const interestadual = ctx.ufOrigem.toUpperCase() !== ctx.ufDestino.toUpperCase();
  const consumidorFinal = ctx.customerType === "non_taxpayer";
  const aplicaDifal = interestadual && consumidorFinal;

  // Alíquota interna da UF de destino (vinda da planilha).
  const pInterna = snapshot.icms.aliquota;
  const pICMS = interestadual
    ? resolveAliqIcmsInterestadual(rule, snapshot, ctx, fallbackAliqIcms, pInterna)
    : pInterna;

  return {
    numeroItem: linha.numeroItem ?? 1,
    codigo: linha.codigo,
    descricao: linha.descricao,
    ncm: linha.ncm,
    cfop: linha.cfop,
    unidade: linha.unidade,
    cest: linha.cest,
    ean: linha.ean,
    exTipi: linha.exTipi,
    quantidade: linha.quantidade,
    valorUnitario: linha.valorUnitario,
    frete: linha.frete,
    seguro: linha.seguro,
    despesasAcessorias: linha.despesasAcessorias,
    desconto: linha.desconto,
    icms: {
      cst: snapshot.icms.cst,
      orig: linha.origem,
      pICMS,
      modBC: 3,
      pRedBC: snapshot.icms.pRedBc,
      pFCP: snapshot.icms.pIcmsFcp,
    },
  // IPI com alíquota zero ainda deve ir ao XML (ex.: CST 55 + cEnq 103 na remessa).
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
    difal: aplicaDifal
      ? {
          pICMSInter: pICMS,
          pICMSUFDest: pInterna,
          pFCPUFDest: snapshot.icms.pIcmsFcp,
          pRedBC: snapshot.icms.pRedBcDifal,
        }
      : undefined,
    // IPI integra a base do ICMS na venda a consumidor final (espelha XML real ML).
    incluirIpiNaBaseIcms: consumidorFinal,
  };
}

/**
 * Calcula a nota inteira (itens + totais) para remessa e demais operações multi-item.
 * Delega aritmética a `calcularNotaFiscal` (tax-engine).
 */
export function calcularImpostosNota(
  linhas: { linha: LinhaPedido; rule: ResolvedTaxRule | null }[],
  ctx: ContextoFiscal,
  fallbackAliqIcms: number,
): NotaFiscalResult {
  const itens = linhas.map(({ linha, rule }, i) =>
    montarItemFiscal({ ...linha, numeroItem: linha.numeroItem ?? i + 1 }, rule, ctx, fallbackAliqIcms),
  );
  return calcularNotaFiscal(itens);
}

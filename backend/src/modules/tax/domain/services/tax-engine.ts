/**
 * Engine de Cálculo Tributário — NF-e Modelo 55, versão 4.00 (Regime Normal).
 *
 * Este módulo é PURO: não importa Prisma nem faz I/O. Recebe os valores e as
 * alíquotas já resolvidas (o serviço `tax-calculation-service` é quem busca no
 * banco) e devolve a árvore matemática pronta para virar XML.
 *
 * Princípios (para não tomar rejeição da SEFAZ — ex.: 532/533 e totais divergentes):
 *
 *  1. ICMS é "imposto por dentro" (embutido no preço). Quando o IPI integra a
 *     base (venda a consumidor final / não contribuinte), ele é somado à base
 *     do ICMS — exatamente como os XMLs reais do fulfillment ML demonstram.
 *
 *  2. Todo valor calculado a NÍVEL DE ITEM é arredondado comercialmente para 2
 *     casas decimais via `round2` (Number(x.toFixed(2))). O FCP NUNCA é somado
 *     ao pICMS: ele tem tags próprias (pFCP/vFCP).
 *
 *  3. O bloco <total> (ICMSTot) é EXCLUSIVAMENTE a soma (reduce) dos valores já
 *     arredondados de cada item. Nunca recalculamos imposto sobre o total da
 *     nota. Assim o vNF "bate na vírgula" com a soma dos itens.
 *
 *  4. PIS/COFINS — base de cálculo composta pela configuração do tenant
 *     (`fiscal-settings.composicaoBaseCalculo.pisCofins`) injetada via
 *     {@link PisCofinsInput.baseConfig}. O engine NÃO conhece o que está no
 *     painel "Config. fiscais"; recebe apenas o vetor de 8 flags
 *     (`frete`, `desconto`, `icms`, `difal`, `fcpIcms`, `fcpDifal`, `ipi`,
 *     `acrescimo`) já resolvido para o canal da operação (venda × remessa).
 *
 *     Quando o tenant adota a Tese do Século (STF RE 574.706/PR), `icms` e
 *     `difal` virão como `DEDUCT` — exatamente como nos defaults do
 *     `fiscal-settings`. A trava `Math.max(0, …)` impede base negativa em
 *     cenários atípicos (descontos > receita).
 */

import {
  LEGACY_BASE_PIS_COFINS_CONFIG,
  type BasePisCofinsConfig,
} from "../entities/base-pis-cofins-config.entity.js";

export type { BasePisCofinsConfig } from "../entities/base-pis-cofins-config.entity.js";

/** Arredondamento comercial para 2 casas (meio-para-cima), nível de item. */
export function round2(value: number): number {
  // toFixed faz o arredondamento meio-para-cima na 2ª casa; Number remove o padding.
  return Number((value + Number.EPSILON).toFixed(2));
}

/** Percentual seguro: trata null/undefined/NaN como 0. */
function pct(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** CSTs em que o ICMS próprio não gera base/valor (isenção, ST retido, não tributado). */
const ICMS_CST_SEM_TRIBUTACAO_PROPRIA = new Set(["40", "41", "50", "60"]);

function isIcmsSemTributacaoPropria(cst: string, pICMS: number, pFCP: number): boolean {
  return ICMS_CST_SEM_TRIBUTACAO_PROPRIA.has(cst.slice(0, 2)) || (pICMS === 0 && pFCP === 0);
}

export type IcmsInput = {
  /** CST (Regime Normal: 00, 20, 40, 41, 51, 60…). */
  cst: string;
  /** Origem da mercadoria (orig 0–8). */
  orig: number;
  /** Alíquota efetivamente aplicada no <ICMS00>/<ICMSxx> (%). */
  pICMS: number;
  /** Modalidade da base (modBC). Padrão 3 = valor da operação. */
  modBC?: number;
  /** % de redução da base de cálculo (pRedBC). */
  pRedBC?: number;
  /** Alíquota do FCP (Fundo de Combate à Pobreza) — tags próprias. */
  pFCP?: number;
};

export type IpiInput = {
  cst: string;
  pIPI: number;
  cEnq?: string;
};

export type PisCofinsInput = {
  cst: string;
  /** Alíquota (pPIS/pCOFINS) em %. */
  aliquota: number;
  /** % de redução da base (alguns benefícios reduzem a base do PIS/COFINS). */
  pRedBC?: number;
  /**
   * Composição da base de cálculo (8 componentes) já resolvida para o canal
   * (venda × remessa) pela camada `application`. Vem de
   * `FiscalEmitterSettings.taxes.composicaoBaseCalculo.pisCofins`.
   *
   * Ausente: usa {@link LEGACY_BASE_PIS_COFINS_CONFIG} — comportamento legado
   * (frete na base + desconto subtraído; sem exclusão de ICMS/DIFAL).
   */
  baseConfig?: BasePisCofinsConfig;
};

/** Partilha do ICMS interestadual para consumidor final (ICMSUFDest / DIFAL). */
export type DifalInput = {
  /** Alíquota interestadual (pICMSInter) — a mesma do ICMS próprio. */
  pICMSInter: number;
  /** Alíquota interna da UF de destino (pICMSUFDest). */
  pICMSUFDest: number;
  /** % do FCP da UF de destino (pFCPUFDest). */
  pFCPUFDest?: number;
  /** % de redução da base do DIFAL (pRedBCDifal). */
  pRedBC?: number;
  /** % de partilha para a UF de destino (pICMSInterPart). Padrão 100% (EC 87/2015, regra atual). */
  pICMSInterPart?: number;
};

export type ItemFiscalInput = {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  cest?: string;
  ean?: string;
  exTipi?: string;

  quantidade: number;
  valorUnitario: number;

  /** Frete rateado para o item. */
  frete?: number;
  /** Seguro rateado para o item. */
  seguro?: number;
  /** Outras despesas acessórias rateadas para o item. */
  despesasAcessorias?: number;
  /** Desconto do item. */
  desconto?: number;

  icms: IcmsInput;
  ipi?: IpiInput;
  pis: PisCofinsInput;
  cofins: PisCofinsInput;
  difal?: DifalInput;

  /**
   * Se o IPI integra a base do ICMS. Verdadeiro nas vendas a consumidor final /
   * não contribuinte (reproduz os XMLs reais do ML). O serviço decide com base
   * em origem × destino × tipo de cliente.
   */
  incluirIpiNaBaseIcms?: boolean;
};

export type ItemFiscalResult = {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  cest?: string;
  ean?: string;
  exTipi?: string;

  quantidade: number;
  valorUnitario: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vOutro: number;

  icms: {
    cst: string;
    orig: number;
    modBC: number;
    vBC: number;
    pICMS: number;
    vICMS: number;
    pFCP: number;
    vFCP: number;
  };
  ipi?: {
    cst: string;
    cEnq: string;
    vBC: number;
    pIPI: number;
    vIPI: number;
  };
  pis: { cst: string; vBC: number; pPIS: number; vPIS: number };
  cofins: { cst: string; vBC: number; pCOFINS: number; vCOFINS: number };
  difal?: {
    vBCUFDest: number;
    pICMSUFDest: number;
    pICMSInter: number;
    pICMSInterPart: number;
    vICMSUFDest: number;
    vICMSUFRemet: number;
    vBCFCPUFDest: number;
    pFCPUFDest: number;
    vFCPUFDest: number;
  };
};

export type NotaFiscalTotais = {
  vBC: number;
  vICMS: number;
  vFCP: number;
  vBCST: number;
  vST: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vIPI: number;
  vPIS: number;
  vCOFINS: number;
  vOutro: number;
  vFCPUFDest: number;
  vICMSUFDest: number;
  vICMSUFRemet: number;
  /** Valor total da nota. */
  vNF: number;
};

export type NotaFiscalResult = {
  itens: ItemFiscalResult[];
  totais: NotaFiscalTotais;
};

/**
 * Calcula um único item (<det>).
 *
 * Fluxo da Base de Cálculo (cascata):
 *   vProd                       = qtd × valorUnitário
 *   baseBruta                   = vProd + frete + seguro + outras − desconto
 *   IPI                         = baseBruta × pIPI            (base própria)
 *   baseICMS (antes da redução)  = baseBruta (+ vIPI se consumidor final)
 *   vBC ICMS                    = baseICMS × (1 − pRedBC/100)
 *   vICMS                       = vBC × pICMS
 *   vFCP                        = vBC × pFCP                  (tag separada)
 *   DIFAL (consumidor final UF) = vBCUFDest × (pInterna − pInter)
 *   PIS/COFINS                  = (basePisCofins) × (1 − pRedBC) × alíquota
 *     onde basePisCofins é montada item-a-item pela `baseConfig` (vinda do
 *     `fiscal-settings` do tenant, projetada para o canal venda/remessa).
 */
export function calcularItem(input: ItemFiscalInput): ItemFiscalResult {
  const frete = round2(pct(input.frete));
  const seguro = round2(pct(input.seguro));
  const outras = round2(pct(input.despesasAcessorias));
  const desconto = round2(pct(input.desconto));

  // 1) Valor do produto.
  const vProd = round2(input.quantidade * input.valorUnitario);

  // 2) Base "bruta" da operação (compartilhada pelos tributos antes de reduções).
  const baseBruta = round2(vProd + frete + seguro + outras - desconto);

  // 3) IPI — incide sobre a base bruta; tem base própria e independe do ICMS.
  let ipiResult: ItemFiscalResult["ipi"];
  let vIPI = 0;
  if (input.ipi) {
    const pIPI = pct(input.ipi.pIPI);
    const vBCIpi = pIPI === 0 ? 0 : baseBruta;
    vIPI = round2(vBCIpi * (pIPI / 100));
    ipiResult = {
      cst: input.ipi.cst,
      cEnq: input.ipi.cEnq ?? "999",
      vBC: vBCIpi,
      pIPI,
      vIPI,
    };
  }

  // 4) Base do ICMS — "por dentro". Em venda a consumidor final, o IPI integra
  //    a base (espelha os XMLs reais do fulfillment ML).
  const baseAntesReducao = round2(baseBruta + (input.incluirIpiNaBaseIcms ? vIPI : 0));
  const pRedBcIcms = pct(input.icms.pRedBC);
  const pICMS = pct(input.icms.pICMS);
  const pFCP = pct(input.icms.pFCP);
  const vBCIcmsBruta = round2(baseAntesReducao * (1 - pRedBcIcms / 100));
  const semTributacaoIcms = isIcmsSemTributacaoPropria(input.icms.cst, pICMS, pFCP);
  const vBCIcms = semTributacaoIcms ? 0 : vBCIcmsBruta;
  const vICMS = semTributacaoIcms ? 0 : round2(vBCIcms * (pICMS / 100));
  const vFCP = semTributacaoIcms ? 0 : round2(vBCIcms * (pFCP / 100));

  // 5) DIFAL (ICMSUFDest) — partilha para consumidor final em operação interestadual.
  //    Calculado ANTES de PIS/COFINS para que possa ser deduzido da base (Tese
  //    do Século aplicada ao diferencial — STF RE 574.706 + Lei 14.395/2022).
  let difalResult: ItemFiscalResult["difal"];
  let vICMSUFDest = 0;
  let vICMSUFRemet = 0;
  if (input.difal) {
    const pRedDifal = pct(input.difal.pRedBC);
    const vBCUFDest = round2(baseAntesReducao * (1 - pRedDifal / 100));
    const pICMSUFDest = pct(input.difal.pICMSUFDest);
    const pICMSInter = pct(input.difal.pICMSInter);
    const pICMSInterPart = pct(input.difal.pICMSInterPart ?? 100);
    // DIFAL = base × (alíquota interna destino − alíquota interestadual).
    const vDifalTotal = round2(
      round2(vBCUFDest * (pICMSUFDest / 100)) - round2(vBCUFDest * (pICMSInter / 100)),
    );
    const vDifalPositivo = Math.max(0, vDifalTotal);
    vICMSUFDest = round2(vDifalPositivo * (pICMSInterPart / 100));
    vICMSUFRemet = round2(vDifalPositivo - vICMSUFDest);
    const pFCPUFDest = pct(input.difal.pFCPUFDest);
    const vBCFCPUFDest = pFCPUFDest > 0 ? vBCUFDest : 0;
    const vFCPUFDest = round2(vBCFCPUFDest * (pFCPUFDest / 100));
    difalResult = {
      vBCUFDest,
      pICMSUFDest,
      pICMSInter,
      pICMSInterPart,
      vICMSUFDest,
      vICMSUFRemet,
      vBCFCPUFDest,
      pFCPUFDest,
      vFCPUFDest,
    };
  }

  // 6) PIS e COFINS — base composta pelos 8 componentes do `baseConfig` (vindo
  //    de `fiscal-settings.composicaoBaseCalculo.pisCofins` projetado para o
  //    canal da operação) + redução opcional por benefício. A composição é
  //    aplicada ANTES da redução; trava `Math.max(0, …)` impede base negativa.
  //
  //    Fórmula (canal já resolvido pelo caller):
  //      base = vProd
  //           + vSeg                                  (seguro sempre compõe)
  //           + (frete    === INCLUDE ? vFrete    : 0)
  //           + (acrescimo === INCLUDE ? vOutro    : 0)
  //           + (ipi       === INCLUDE ? vIPI      : 0)
  //           − (desconto  === DEDUCT  ? vDesc     : 0)
  //           − (icms      === DEDUCT  ? vICMS     : 0)
  //           − (difal     === DEDUCT  ? vICMSUFDest + vICMSUFRemet : 0)
  //           − (fcpIcms   === DEDUCT  ? vFCP      : 0)
  //           − (fcpDifal  === DEDUCT  ? vFCPUFDest: 0)
  const pPIS = pct(input.pis.aliquota);
  const pCOFINS = pct(input.cofins.aliquota);
  const vFCPUFDest = difalResult?.vFCPUFDest ?? 0;
  const baseAjustePisCofins = (config: BasePisCofinsConfig | undefined): number => {
    const cfg = config ?? LEGACY_BASE_PIS_COFINS_CONFIG;
    const incluirFrete = cfg.frete === "INCLUDE";
    const incluirIpi = cfg.ipi === "INCLUDE";
    const incluirAcrescimo = cfg.acrescimo === "INCLUDE";
    const subtrairDesconto = cfg.desconto === "DEDUCT";
    const subtrairIcms = cfg.icms === "DEDUCT";
    const subtrairDifal = cfg.difal === "DEDUCT";
    const subtrairFcpIcms = cfg.fcpIcms === "DEDUCT";
    const subtrairFcpDifal = cfg.fcpDifal === "DEDUCT";

    const incluirParts =
      (incluirFrete ? frete : 0) +
      (incluirAcrescimo ? outras : 0) +
      (incluirIpi ? vIPI : 0);
    const subtrairParts =
      (subtrairDesconto ? desconto : 0) +
      (subtrairIcms ? vICMS : 0) +
      (subtrairDifal ? round2(vICMSUFDest + vICMSUFRemet) : 0) +
      (subtrairFcpIcms ? vFCP : 0) +
      (subtrairFcpDifal ? vFCPUFDest : 0);

    return round2(vProd + seguro + incluirParts - subtrairParts);
  };
  const basePisBruta = Math.max(0, baseAjustePisCofins(input.pis.baseConfig));
  const baseCofinsBruta = Math.max(0, baseAjustePisCofins(input.cofins.baseConfig));
  const vBCPisBruta = round2(basePisBruta * (1 - pct(input.pis.pRedBC) / 100));
  const vBCCofinsBruta = round2(baseCofinsBruta * (1 - pct(input.cofins.pRedBC) / 100));
  const vBCPis = pPIS === 0 ? 0 : vBCPisBruta;
  const vBCCofins = pCOFINS === 0 ? 0 : vBCCofinsBruta;
  const vPIS = round2(vBCPis * (pPIS / 100));
  const vCOFINS = round2(vBCCofins * (pCOFINS / 100));

  return {
    numeroItem: input.numeroItem,
    codigo: input.codigo,
    descricao: input.descricao,
    ncm: input.ncm,
    cfop: input.cfop,
    unidade: input.unidade,
    cest: input.cest,
    ean: input.ean,
    exTipi: input.exTipi,
    quantidade: input.quantidade,
    valorUnitario: input.valorUnitario,
    vProd,
    vFrete: frete,
    vSeg: seguro,
    vDesc: desconto,
    vOutro: outras,
    icms: {
      cst: input.icms.cst,
      orig: input.icms.orig,
      modBC: input.icms.modBC ?? 3,
      vBC: vBCIcms,
      pICMS,
      vICMS,
      pFCP,
      vFCP,
    },
    ipi: ipiResult,
    pis: { cst: input.pis.cst, vBC: vBCPis, pPIS: pPIS, vPIS },
    cofins: { cst: input.cofins.cst, vBC: vBCCofins, pCOFINS: pCOFINS, vCOFINS },
    difal: difalResult,
  };
}

/**
 * Soma (reduce) dos valores JÁ ARREDONDADOS de cada item.
 * Nunca recalcula imposto sobre agregados.
 */
export function calcularTotais(itens: ItemFiscalResult[]): NotaFiscalTotais {
  const acc: NotaFiscalTotais = {
    vBC: 0, vICMS: 0, vFCP: 0, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0,
    vDesc: 0, vIPI: 0, vPIS: 0, vCOFINS: 0, vOutro: 0, vFCPUFDest: 0,
    vICMSUFDest: 0, vICMSUFRemet: 0, vNF: 0,
  };

  for (const item of itens) {
    acc.vBC = round2(acc.vBC + item.icms.vBC);
    acc.vICMS = round2(acc.vICMS + item.icms.vICMS);
    acc.vFCP = round2(acc.vFCP + item.icms.vFCP);
    acc.vProd = round2(acc.vProd + item.vProd);
    acc.vFrete = round2(acc.vFrete + item.vFrete);
    acc.vSeg = round2(acc.vSeg + item.vSeg);
    acc.vDesc = round2(acc.vDesc + item.vDesc);
    acc.vOutro = round2(acc.vOutro + item.vOutro);
    acc.vIPI = round2(acc.vIPI + (item.ipi?.vIPI ?? 0));
    acc.vPIS = round2(acc.vPIS + item.pis.vPIS);
    acc.vCOFINS = round2(acc.vCOFINS + item.cofins.vCOFINS);
    if (item.difal) {
      acc.vICMSUFDest = round2(acc.vICMSUFDest + item.difal.vICMSUFDest);
      acc.vICMSUFRemet = round2(acc.vICMSUFRemet + item.difal.vICMSUFRemet);
      acc.vFCPUFDest = round2(acc.vFCPUFDest + item.difal.vFCPUFDest);
    }
  }

  // vNF (regra oficial da SEFAZ): produtos + ST + frete + seguro + outras + IPI
  //                              − desconto − ICMS desonerado.
  // Quando IPI = 0, recai na fórmula simplificada: vProd + vFrete − vDesc.
  acc.vNF = round2(
    acc.vProd + acc.vST + acc.vFrete + acc.vSeg + acc.vOutro + acc.vIPI - acc.vDesc,
  );

  return acc;
}

/** Orquestra o cálculo completo da nota: itens + totais. */
export function calcularNotaFiscal(itens: ItemFiscalInput[]): NotaFiscalResult {
  const itensCalculados = itens.map(calcularItem);
  return {
    itens: itensCalculados,
    totais: calcularTotais(itensCalculados),
  };
}

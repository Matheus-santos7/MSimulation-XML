/**
 * Aplica o DE/PARA de CST da tela Config. fiscais → CST devolução
 * (`cstDevolucao`) sobre uma nota já calculada/espelhada.
 *
 * O espelhamento da venda (`mirrorOriginForDevolucao`) copia o CST da origem
 * (MOC finNFe=4). O XML da devolução, porém, deve usar o CST de *entrada*
 * configurado pelo tenant — PIS 01→50, CSOSN 102→41, etc.
 *
 * ICMS 40/41/50 (grupo `<ICMS40>`) e 30/60 sem tributação própria não podem
 * carregar vBC/vICMS > 0 — Rejeição 532 (MOC 7.0: totais = soma dos itens;
 * o grupo ICMS40 omite bases). PIS/COFINS só troca o CST; bases e valores
 * permanecem (crédito da entrada). IPI não entra neste DE/PARA.
 */

import { mapCstDevolucao, type FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import { calcularTotais, type ItemFiscalResult, type NotaFiscalResult } from "./tax-engine.js";

type CstDevolucaoSettings = FiscalEmitterSettingsData["taxes"]["cstDevolucao"];

/** CSTs em que o ICMS próprio não gera base/valor no XML (ICMS40 / ST retido). */
const ICMS_CST_SEM_TRIBUTACAO_PROPRIA = new Set(["30", "40", "41", "50", "60"]);

function cst2(cst: string): string {
  return cst.trim().slice(0, 2);
}

function applyItem(item: ItemFiscalResult, cfg: CstDevolucaoSettings): ItemFiscalResult {
  const icmsCst = mapCstDevolucao(item.icms.cst, cfg.icms);
  const pisCst = mapCstDevolucao(item.pis.cst, cfg.pisCofins);
  const cofinsCst = mapCstDevolucao(item.cofins.cst, cfg.pisCofins);

  const icms = { ...item.icms, cst: icmsCst };
  if (ICMS_CST_SEM_TRIBUTACAO_PROPRIA.has(cst2(icmsCst))) {
    icms.vBC = 0;
    icms.vICMS = 0;
    icms.pICMS = 0;
    icms.pFCP = 0;
    icms.vFCP = 0;
  }

  return {
    ...item,
    icms,
    pis: { ...item.pis, cst: pisCst },
    cofins: { ...item.cofins, cst: cofinsCst },
  };
}

export function applyCstDevolucaoMap(
  invoice: NotaFiscalResult,
  cstDevolucao: CstDevolucaoSettings,
): NotaFiscalResult {
  if (cstDevolucao.mode === "DEFAULT") return invoice;

  const itens = invoice.itens.map((item) => applyItem(item, cstDevolucao));
  const unchanged = itens.every(
    (item, i) =>
      item.icms.cst === invoice.itens[i]!.icms.cst &&
      item.pis.cst === invoice.itens[i]!.pis.cst &&
      item.cofins.cst === invoice.itens[i]!.cofins.cst &&
      item.icms.vBC === invoice.itens[i]!.icms.vBC &&
      item.icms.vICMS === invoice.itens[i]!.icms.vICMS,
  );
  if (unchanged) return invoice;

  return { itens, totais: calcularTotais(itens) };
}

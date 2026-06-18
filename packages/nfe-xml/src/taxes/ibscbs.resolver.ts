/**
 * Resolver puro de IBSCBS (reforma tributária) — retorna objetos AST, nunca strings XML.
 *
 * Espelha:
 * - `ibsCbsImpostoXml` (interno) em `nfe-xml-blocks.ts`
 * - `ibsCbsImpostoXmlVenda` e `ibsCbsImpostoXmlRemessa` (exportados)
 *
 * @module taxes/ibscbs.resolver
 */

import type { NfeIbsCbsImposto } from "../core/nfe-ast.types.js";
import {
  calcIbsCbsVendaValues,
  REMESSA_IBS_CBS_DEFAULTS,
  VENDA_IBS_CBS_DEFAULTS,
  type IbsCbsDefaults,
} from "../fiscal/fiscal-xml.util.js";
import { asNumeric, formatMoney2 } from "./tax-format.util.js";

/** Parâmetros do resolver base IBSCBS. */
export type IbsCbsImpostoInput = {
  ibsCbs?: Record<string, unknown> | null;
  defaults: IbsCbsDefaults;
  /** Quando true, emite mesmo sem dados explícitos no payload (remessa ML). */
  alwaysEmit: boolean;
  vBC?: number | null;
};

function readVendaIbsCbsRates(ibsCbs?: Record<string, unknown> | null) {
  return {
    pIBSUF: asNumeric(ibsCbs?.pIBSUF, 0.1),
    pIBSMun: asNumeric(ibsCbs?.pIBSMun, 0),
    pCBS: asNumeric(ibsCbs?.pCBS, 0.9),
  };
}

/**
 * Resolve `<IBSCBS>` base (remessa / payload simples).
 * Espelha `ibsCbsImpostoXml` — retorna `null` quando o original retornaria string vazia.
 */
export function resolveIbsCbsImposto(input: IbsCbsImpostoInput): NfeIbsCbsImposto | null {
  const { ibsCbs, defaults, alwaysEmit, vBC } = input;
  const hasExplicit =
    !!ibsCbs && (ibsCbs.st != null || ibsCbs.cst != null || ibsCbs.cClassTrib != null);
  if (!alwaysEmit && !hasExplicit) return null;

  const cst = String(ibsCbs?.st ?? ibsCbs?.cst ?? defaults.cst).slice(0, 3);
  const cClassTrib = String(ibsCbs?.cClassTrib ?? defaults.cClassTrib).slice(0, 6);

  const node: NfeIbsCbsImposto = {
    IBSCBS: {
      CST: cst,
      cClassTrib,
    },
  };

  if (vBC != null && Number.isFinite(vBC)) {
    (node.IBSCBS as Record<string, unknown>).gIBSCBS = {
      vBC: formatMoney2(vBC),
    };
  }

  return node;
}

/**
 * Resolve `<IBSCBS>` de venda ML com grupos gIBSUF, gIBSMun e gCBS.
 * Espelha `ibsCbsImpostoXmlVenda`.
 */
export function resolveIbsCbsImpostoVenda(
  ibsCbs?: Record<string, unknown> | null,
  vBC?: number | null,
): NfeIbsCbsImposto | null {
  const hasExplicit =
    !!ibsCbs && (ibsCbs.st != null || ibsCbs.cst != null || ibsCbs.cClassTrib != null);
  if (!hasExplicit || vBC == null || !Number.isFinite(vBC)) return null;

  const cst = String(ibsCbs?.st ?? ibsCbs?.cst ?? VENDA_IBS_CBS_DEFAULTS.cst).slice(0, 3);
  const cClassTrib = String(ibsCbs?.cClassTrib ?? VENDA_IBS_CBS_DEFAULTS.cClassTrib).slice(0, 6);
  const rates = readVendaIbsCbsRates(ibsCbs);
  const { vIBSUF, vIBSMun, vIBS, vCBS } = calcIbsCbsVendaValues(vBC, rates);

  return {
    IBSCBS: {
      CST: cst,
      cClassTrib,
      gIBSCBS: {
        vBC: formatMoney2(vBC),
        gIBSUF: { pIBSUF: rates.pIBSUF.toFixed(2), vIBSUF: formatMoney2(vIBSUF) },
        gIBSMun: { pIBSMun: rates.pIBSMun.toFixed(2), vIBSMun: formatMoney2(vIBSMun) },
        vIBS: formatMoney2(vIBS),
        gCBS: { pCBS: rates.pCBS.toFixed(2), vCBS: formatMoney2(vCBS) },
      },
    },
  };
}

/**
 * Resolve `<IBSCBS>` de remessa — sempre emite (padrão ML reforma tributária).
 * Espelha `ibsCbsImpostoXmlRemessa`.
 */
export function resolveIbsCbsImpostoRemessa(
  ibsCbs?: Record<string, unknown> | null,
  vBC?: number | null,
): NfeIbsCbsImposto | null {
  return resolveIbsCbsImposto({
    ibsCbs,
    defaults: REMESSA_IBS_CBS_DEFAULTS,
    alwaysEmit: true,
    vBC,
  });
}

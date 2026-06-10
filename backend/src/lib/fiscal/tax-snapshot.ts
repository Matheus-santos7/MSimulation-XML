/**
 * Converte `ResolvedTaxRule` (planilha) em snapshot normalizado para payload/XML.
 * Usado na remessa em conjunto com `enrichTaxSnapshot` (configurações do emissor).
 * @see docs/remessa-fisica.md — Fase 4 e 6
 */
import type { ResolvedTaxRule } from "../../services/fiscal/tax/tax-rule-service.js";

export function taxSnapshotFromRule(rule: ResolvedTaxRule | null, fallbackAliqIcms: number) {
  const taxes = ((rule?.payload?.taxes as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    unknown
  >;
  const ipi = (taxes.ipi as Record<string, unknown> | undefined) ?? {};
  const pis = (taxes.pis as Record<string, unknown> | undefined) ?? {};
  const cofins = (taxes.cofins as Record<string, unknown> | undefined) ?? {};
  const ibsCbs = (taxes.ibsCbs as Record<string, unknown> | undefined) ?? {};

  const toText = (v: unknown, fallback = ""): string => {
    if (v == null) return fallback;
    if (typeof v === "string") {
      const t = v.trim();
      return t || fallback;
    }
    if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
    return fallback;
  };
  const toNum = (v: unknown, fallback = 0): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    ruleId: rule?.ruleId,
    icms: {
      cst: typeof rule?.icms?.cst === "string" ? rule.icms.cst : "00",
      aliquota: rule?.aliquotaIcmsInterna ?? fallbackAliqIcms,
      pDif: toNum(rule?.icms?.pDif, 0),
      pIcmsInterstate: rule?.icms?.pIcmsInterstate,
      pRedBc: toNum(rule?.icms?.pRedBc, 0),
      pRedBcSt: toNum(rule?.icms?.pRedBcSt, 0),
      pMva: toNum(rule?.icms?.pMva, 0),
      pIcmsStRet: toNum(rule?.icms?.pIcmsStRet, 0),
      pFcpStRet: toNum(rule?.icms?.pFcpStRet, 0),
      pIcmsFcp: toNum(rule?.icms?.pIcmsFcp, 0),
      pIcmsEfet: toNum(rule?.icms?.pIcmsEfet, 0),
      pRedBcEfet: toNum(rule?.icms?.pRedBcEfet, 0),
      pRedBcDifal: toNum(rule?.icms?.pRedBcDifal, 0),
      motDesIcms: toNum(rule?.icms?.motDesIcms, 0),
      codBenef: toText(rule?.icms?.codBenef),
      codBenefRbc: toText(rule?.icms?.codBenefRbc),
      codBenefPres: toText(rule?.icms?.codBenefPres),
      pCodBenefPres: toNum(rule?.icms?.pCodBenefPres, 0),
      redAliqIbs: toNum(rule?.icms?.redAliqIbs, 0),
    },
    ipi: {
      st: toText(ipi.st, "50 - Saída Tributada"),
      aliquota: toNum(ipi.aliquota, 0),
      codEnq: toText(ipi.codEnq, "999"),
    },
    pis: {
      st: toText(pis.st, "01 - Operação Tributável com Alíquota Básica"),
      aliquota: toNum(pis.aliquota, 1.65),
    },
    cofins: {
      st: toText(cofins.st, "01 - Operação Tributável com Alíquota Básica"),
      aliquota: toNum(cofins.aliquota, 7.6),
    },
    ibsCbs: {
      st: toText(ibsCbs.st),
      cClassTrib: toText(ibsCbs.cClassTrib),
      reducao: toNum(ibsCbs.reducao, 0),
    },
  };
}

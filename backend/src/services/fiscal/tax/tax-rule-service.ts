import type { PrismaTx } from "../../../lib/db/prisma-tx.js";
import {
  buildTaxRuleRowId,
  type CustomerType,
  type TransactionType,
} from "../../../lib/fiscal/tax-rule-ids.js";

export type { CustomerType, TransactionType };

export type ResolvedTaxRule = {
  ruleId: string;
  aliquotaIcmsInterna?: number;
  cfop?: string;
  payload?: Record<string, unknown>;
  icms?: {
    cst?: string;
    pDif?: number;
    pIcmsInternal?: number;
    pIcmsInterstate?: number;
    pRedBc?: number;
    pRedBcSt?: number;
    pRedBcDifal?: number;
    pIcmsFcp?: number;
    pIcmsEfet?: number;
    pRedBcEfet?: number;
    pMva?: number;
    pIcmsStRet?: number;
    pFcpStRet?: number;
    codBenef?: string;
    codBenefRbc?: string;
    codBenefPres?: string;
    pCodBenefPres?: number;
    motDesIcms?: number;
    redAliqIbs?: number;
  };
};

function toNum(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = String(value).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

type TaxRuleRow = {
  ruleId: string;
  origin: string | null;
  uf: string;
  cfop: string;
  payload: unknown;
};

/** UF fiscal da linha: prioriza `uf` (2 letras) em vez de fatiar `origin` (texto livre da planilha). */
function fiscalOriginUfFromRule(rule: Pick<TaxRuleRow, "origin" | "uf">): string {
  const uf = rule.uf?.trim().toUpperCase();
  if (uf && uf.length === 2) return uf;
  const origin = rule.origin?.trim().toUpperCase() ?? "";
  if (origin.length === 2) return origin;
  const match = origin.match(/\b([A-Z]{2})\b/);
  return match?.[1] ?? origin.slice(0, 2);
}

function ruleIdEmbedsOrigin(ruleId: string, originUf: string): boolean {
  return ruleId.toUpperCase().includes(`-${originUf}-`);
}

function taxRuleMatchesOrigin(rule: TaxRuleRow, originUf: string): boolean {
  if (ruleIdEmbedsOrigin(rule.ruleId, originUf)) return true;
  return fiscalOriginUfFromRule(rule) === originUf;
}

async function findTaxRuleRow(
  prisma: PrismaTx,
  tenantId: string,
  params: {
    ruleBaseId?: string;
    originUf: string;
    transactionType: TransactionType;
    customerType: CustomerType;
  },
): Promise<TaxRuleRow | null> {
  const { ruleBaseId, originUf, transactionType, customerType } = params;

  if (ruleBaseId) {
    const candidates = [
      buildTaxRuleRowId(ruleBaseId, customerType, transactionType, originUf),
      buildTaxRuleRowId(ruleBaseId, customerType, transactionType),
    ];

    for (const candidateId of candidates) {
      const row = await prisma.taxRule.findUnique({
        where: { tenantId_ruleId: { tenantId, ruleId: candidateId } },
      });
      if (row && taxRuleMatchesOrigin(row, originUf)) return row;
    }

    const fallback = await prisma.taxRule.findFirst({
      where: {
        tenantId,
        transactionType,
        customerType,
        ruleId: { startsWith: `${ruleBaseId}-` },
        OR: [{ uf: originUf }, { origin: { startsWith: originUf } }],
      },
      orderBy: { updatedAt: "desc" },
    });
    if (fallback && taxRuleMatchesOrigin(fallback, originUf)) return fallback;
    return null;
  }

  return prisma.taxRule.findFirst({
    where: {
      tenantId,
      source: "xlsx",
      transactionType,
      customerType,
      OR: [{ uf: originUf }, { origin: { startsWith: originUf } }],
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Resolve linha da planilha fiscal (`tax_rules`).
 *
 * Remessa física chama com:
 *  - `transactionType: "inbound"`, `customerType: "taxpayer"`
 *  - `ruleBaseId` do produto → ID `{base}-taxpayer-inbound`
 *  - `originUf` = tenant, `destinationUf` = CD → colunas `ICMS_{UF}_*` do payload
 *
 * @see docs/remessa-fisica.md — Fase 3
 */
export async function resolveTaxRule(
  prisma: PrismaTx,
  tenantId: string,
  params: {
    originUf: string;
    destinationUf: string;
    transactionType: TransactionType;
    customerType: CustomerType;
    ruleBaseId?: string;
  },
): Promise<ResolvedTaxRule | null> {
  const originUf = params.originUf.toUpperCase().trim();
  const destinationUf = params.destinationUf.toUpperCase().trim();

  const rule = await findTaxRuleRow(prisma, tenantId, {
    ruleBaseId: params.ruleBaseId?.trim(),
    originUf,
    transactionType: params.transactionType,
    customerType: params.customerType,
  });
  if (!rule) return null;

  const payload = (rule.payload ?? {}) as Record<string, unknown>;
  const icmsByUf = (payload.icmsByUf ?? {}) as Record<string, unknown>;
  const aliq = toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_INTERNAL`]);
  const cstRaw = icmsByUf[`ICMS_${destinationUf}_CST`];
  const cst = typeof cstRaw === "string" ? cstRaw.slice(0, 2) : undefined;

  return {
    ruleId: rule.ruleId,
    aliquotaIcmsInterna: aliq,
    cfop: rule.cfop || undefined,
    payload,
    icms: {
      cst,
      pDif: toNum(icmsByUf[`ICMS_${destinationUf}_PDIF`]),
      pIcmsInternal: toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_INTERNAL`]),
      pIcmsInterstate: toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_INTERSTATE`]),
      pRedBc: toNum(icmsByUf[`ICMS_${destinationUf}_REDUCTION_CALC_BASE`]),
      pRedBcSt: toNum(icmsByUf[`ICMS_${destinationUf}_REDUCTION_CALC_BASE_ST`]),
      pRedBcDifal: toNum(icmsByUf[`ICMS_${destinationUf}_REDUCTION_CALC_DIFAL`]),
      pIcmsFcp: toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_FCP`]),
      pIcmsEfet: toNum(icmsByUf[`ICMS_${destinationUf}_PICMS_EFET`]),
      pRedBcEfet: toNum(icmsByUf[`ICMS_${destinationUf}_PREDB_CEFET`]),
      pMva: toNum(icmsByUf[`ICMS_${destinationUf}_MVA`]),
      pIcmsStRet: toNum(icmsByUf[`ICMS_${destinationUf}_PICMSST_RET`]),
      pFcpStRet: toNum(icmsByUf[`ICMS_${destinationUf}_PFCPST_RET`]),
      codBenef:
        typeof icmsByUf[`ICMS_${destinationUf}_COD_BENEF`] === "string"
          ? String(icmsByUf[`ICMS_${destinationUf}_COD_BENEF`])
          : undefined,
      codBenefRbc:
        typeof icmsByUf[`ICMS_${destinationUf}_COD_BENEF_RBC`] === "string"
          ? String(icmsByUf[`ICMS_${destinationUf}_COD_BENEF_RBC`])
          : undefined,
      codBenefPres:
        typeof icmsByUf[`ICMS_${destinationUf}_COD_BENEF_PRES`] === "string"
          ? String(icmsByUf[`ICMS_${destinationUf}_COD_BENEF_PRES`])
          : undefined,
      pCodBenefPres: toNum(icmsByUf[`ICMS_${destinationUf}_PCOD_BENEF_PRES`]),
      motDesIcms: toNum(icmsByUf[`ICMS_${destinationUf}_MOT_DES_ICMS`]),
      redAliqIbs: toNum(icmsByUf[`ICMS_${destinationUf}_RED_ALIQ_IBS`]),
    },
  };
}

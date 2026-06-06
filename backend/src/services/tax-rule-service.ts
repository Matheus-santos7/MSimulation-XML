import type { PrismaTx } from "../lib/db/prisma-tx.js";
import {
  buildTaxRuleRowId,
  type CustomerType,
  type TransactionType,
} from "../lib/tax-rule-ids.js";

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

/**
 * Resolve linha da planilha: origem (UF emitente) × destino (UF destinatário) × tipo de operação × regra do produto.
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

  const ruleId = params.ruleBaseId?.trim()
    ? buildTaxRuleRowId(params.ruleBaseId.trim(), params.customerType, params.transactionType)
    : undefined;

  const rule = ruleId
    ? await prisma.taxRule.findUnique({
        where: { tenantId_ruleId: { tenantId, ruleId } },
      })
    : await prisma.taxRule.findFirst({
        where: {
          tenantId,
          source: "xlsx",
          origin: originUf,
          transactionType: params.transactionType,
          customerType: params.customerType,
        },
        orderBy: { updatedAt: "desc" },
      });

  if (!rule) return null;

  const ruleOrigin = (rule.origin ?? rule.uf).toUpperCase().slice(0, 2);
  if (ruleOrigin !== originUf) return null;

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

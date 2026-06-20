import type { TaxRuleDto } from "@/lib/fiscal-types";

/** Larguras das colunas fixas à esquerda (scroll horizontal nas demais) */
export const TAX_RULES_STICKY_W = { nome: 220, origem: 72, destinatario: 200 } as const;

export const TAX_RULES_STICKY_LEFT = {
  nome: 0,
  origem: TAX_RULES_STICKY_W.nome,
  destinatario: TAX_RULES_STICKY_W.nome + TAX_RULES_STICKY_W.origem,
} as const;

export const TAX_RULES_STICKY_TOTAL =
  TAX_RULES_STICKY_W.nome + TAX_RULES_STICKY_W.origem + TAX_RULES_STICKY_W.destinatario;

/** Ordem da planilha ML; `label` = tooltip, `short` = exibição compacta (1–2 linhas) */
export const TAX_RULES_UF_FIELDS = [
  { suffix: "CST", label: "Situação Tributária CST Regime Normal", short: ["CST", "Regime Normal"] },
  { suffix: "PDIF", label: "Diferimento do ICMS (%)", short: ["Dif. ICMS", "(%)"] },
  { suffix: "PICMS_INTERNAL", label: "Alíquota de ICMS interna (%)", short: ["ICMS", "Interna %"] },
  { suffix: "PICMS_INTERSTATE", label: "Aliquota de ICMS interestadual (%)", short: ["ICMS", "Interest. %"] },
  {
    suffix: "COD_BENEF_RBC",
    label: "Código do Benefício para Redução de base de cálculo",
    short: ["cBenef", "Red. BC"],
  },
  { suffix: "REDUCTION_CALC_BASE", label: "Redução da Base de Cálculo (%)", short: ["Red. BC", "(%)"] },
  { suffix: "REDUCTION_CALC_BASE_ST", label: "Redução da Base de Cálculo ST (%)", short: ["Red. BC", "ST %"] },
  { suffix: "REDUCTION_CALC_DIFAL", label: "Redução da Base de Cálculo do DIFAL (%)", short: ["Red. BC", "DIFAL %"] },
  { suffix: "PICMS_FCP", label: "Alíquota ICMS FCP (%)", short: ["ICMS", "FCP %"] },
  { suffix: "PICMS_EFET", label: "Alíquota do ICMS Efetivo(%)", short: ["ICMS", "Efetivo %"] },
  {
    suffix: "PREDB_CEFET",
    label: "Percentual de redução da base de cálculo do ICMS Efetivo(%)",
    short: ["Red. BC", "ICMS Efet. %"],
  },
  { suffix: "MVA", label: "MVA (Ajustado) (%)", short: ["MVA", "Ajust. %"] },
  {
    suffix: "PICMSST_RET",
    label: "Alíquota suportada de ICMS ST retido anteriormente (para revenda)",
    short: ["ICMS ST Ret.", "Revenda %"],
  },
  {
    suffix: "PFCPST_RET",
    label: "Alíquota de FCP retido anteriormente por ST (para revenda)",
    short: ["FCP ST Ret.", "Revenda %"],
  },
  { suffix: "COD_BENEF", label: "Código de benefício fiscal na UF", short: ["cBenef", "UF"] },
  { suffix: "COD_BENEF_PRES", label: "cBenef do crédito presumido", short: ["cBenef", "Créd. Pres."] },
  { suffix: "PCOD_BENEF_PRES", label: "Percentual de cBenef do crédito presumido", short: ["% cBenef", "Presumido"] },
  { suffix: "MOT_DES_ICMS", label: "Motivo de desoneração", short: ["Mot.", "Desoneração"] },
  { suffix: "RED_ALIQ_IBS", label: "Redução do IBS (%)", short: ["Red.", "IBS %"] },
] as const;

export type TaxRuleGroup = {
  groupId: string;
  nome: string;
  origin: string;
  rows: TaxRuleDto[];
};

export function asTaxRuleRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export function asTaxRuleText(v: unknown, fallback = "—"): string {
  if (v == null) return fallback;
  const t = String(v).trim();
  return t ? t : fallback;
}

export function taxRuleUfCell(icmsByUf: Record<string, unknown>, uf: string, suffix: string): string {
  return asTaxRuleText(icmsByUf[`ICMS_${uf}_${suffix}`]);
}

function contributorLabel(v?: string): string {
  if (v === "taxpayer") return "Contribuinte";
  if (v === "non_taxpayer") return "Não contribuinte";
  return "";
}

function transactionLabel(v?: string): string {
  if (v === "inbound") return "Envio de estoque (Transferência ou Remessa)";
  return "";
}

export function baseTaxRuleId(v: string): string {
  const withOrigin = v.match(/^(.+)-[A-Z]{2}-(taxpayer|non_taxpayer)-(sale|inbound)$/i);
  if (withOrigin) return withOrigin[1]!;
  return v.replace(/[-_](taxpayer|non_taxpayer|sale|inbound)$/i, "").replace(/[-_](taxpayer|non_taxpayer)$/i, "");
}

export function normalizeTaxRuleName(nome: string): string {
  return nome
    .replace(/\s*\((?:contribuinte.*|não contribuinte.*|envio de estoque.*)\)\s*$/i, "")
    .trim();
}

export function compareTaxRulesByContributor(a: TaxRuleDto, b: TaxRuleDto): number {
  const ra = baseTaxRuleId(a.id);
  const rb = baseTaxRuleId(b.id);
  if (ra !== rb) return ra.localeCompare(rb);
  const oa = a.customerType === "taxpayer" ? 0 : a.customerType === "non_taxpayer" ? 1 : 2;
  const ob = b.customerType === "taxpayer" ? 0 : b.customerType === "non_taxpayer" ? 1 : 2;
  return oa - ob;
}

export function buildTaxRuleGroups(sorted: TaxRuleDto[]): TaxRuleGroup[] {
  const map = new Map<string, TaxRuleGroup>();
  for (const row of sorted) {
    const nomeBase = normalizeTaxRuleName(row.nome);
    const groupId = `${baseTaxRuleId(row.id)}::${row.origin ?? row.uf}::${nomeBase}`;
    const prev = map.get(groupId);
    if (prev) {
      prev.rows.push(row);
    } else {
      map.set(groupId, {
        groupId,
        nome: nomeBase,
        origin: row.origin ?? row.uf,
        rows: [row],
      });
    }
  }
  return [...map.values()];
}

export function sortTaxRuleRowsForSheetLayout(rows: TaxRuleDto[]): TaxRuleDto[] {
  const weight = (r: TaxRuleDto) => {
    if (r.transactionType === "inbound") return 2;
    if (r.customerType === "taxpayer") return 0;
    if (r.customerType === "non_taxpayer") return 1;
    return 3;
  };
  return [...rows].sort((a, b) => weight(a) - weight(b));
}

export function showTaxRuleContributorCell(r: TaxRuleDto): string {
  if (r.transactionType === "inbound") return transactionLabel(r.transactionType);
  if (r.customerType === "taxpayer" || r.customerType === "non_taxpayer") {
    return contributorLabel(r.customerType);
  }
  return contributorLabel(r.customerType) || "Envio de estoque (Transferência ou Remessa)";
}

function softText(v: unknown): string {
  const text = asTaxRuleText(v, "");
  return text || "—";
}

function toDecimalNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const raw = String(v).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Planilha ML: 325 → 3,25% | 165 → 1,65% | 17 → 17% */
function normalizePercentForDisplay(n: number): number {
  if (n < 10) return n;
  if (n >= 100) return n / 100;
  if (Number.isInteger(n) && String(Math.round(n)).length >= 3) return n / 100;
  return n;
}

function formatDecimal(v: unknown, digits = 2): string {
  const n = toDecimalNumber(v);
  if (n == null) return softText(v);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatTaxRuleAliquotaPercent(v: unknown, digits = 2): string {
  const n = toDecimalNumber(v);
  if (n == null) return softText(v);
  return formatDecimal(normalizePercentForDisplay(n), digits);
}

const UF_TEXT_SUFFIXES = new Set(["CST", "MOT_DES_ICMS", "COD_BENEF", "COD_BENEF_RBC", "COD_BENEF_PRES"]);

export function formatTaxRuleUfValue(suffix: string, value: unknown): string {
  if (UF_TEXT_SUFFIXES.has(suffix)) return softText(value);
  if (suffix === "PDIF" || suffix === "PCOD_BENEF_PRES" || suffix === "RED_ALIQ_IBS") {
    return formatTaxRuleAliquotaPercent(value, 2);
  }
  const n = toDecimalNumber(value);
  if (n == null) return softText(value);
  const isDirectIcmsPercent =
    (suffix.startsWith("PICMS") || suffix.startsWith("PFCP") || suffix === "MVA") &&
    n >= 10 &&
    n < 100 &&
    Number.isInteger(n);
  const scaled = isDirectIcmsPercent ? n : normalizePercentForDisplay(n);
  return formatDecimal(scaled, 2);
}

export function shortTaxStatus(v: unknown): string {
  return softText(v);
}

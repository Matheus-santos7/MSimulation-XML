import type { ProductInput, TaxRuleCatalogEntry } from "@/lib/fiscal-types";

/** Extrai o RULE_ID curto salvo no produto a partir do valor do select (`baseId::origin`). */
export function taxRuleBaseIdFromFormValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.split("::")[0] ?? trimmed;
}

/** Valor do select alinhado ao catálogo filtrado pela UF do emitente. */
export function taxRuleSelectValue(
  baseId: string | undefined | null,
  catalog: TaxRuleCatalogEntry[],
): string {
  const base = baseId?.trim() ?? "";
  if (!base) return "";
  const entry = catalog.find((r) => r.baseId === base);
  return entry ? `${entry.baseId}::${entry.origin}` : base;
}

export type ProdutoFormValues = {
  sku: string;
  ean: string;
  nome: string;
  ncm: string;
  cest: string;
  exTipi: string;
  origem: string;
  nfci: string;
  unidade: string;
  preco: string;
  precoCusto: string;
  estoque: string;
  taxRuleBaseId: string;
};

export type ProdutoFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string[]>;
  values?: ProdutoFormValues;
};

export function inputToFormValues(input: ProductInput): ProdutoFormValues {
  return {
    sku: input.sku,
    ean: input.ean ?? "",
    nome: input.nome,
    ncm: input.ncm,
    cest: input.cest,
    exTipi: input.exTipi ?? "",
    origem: String(input.origem),
    nfci: input.nfci ?? "",
    unidade: input.unidade,
    preco: String(input.preco),
    precoCusto: String(input.precoCusto ?? ""),
    estoque: String(input.estoque ?? 0),
    taxRuleBaseId: input.taxRuleBaseId ?? "",
  };
}

export function productToFormValues(p: {
  sku: string;
  ean?: string;
  nome: string;
  ncm: string;
  cest: string;
  exTipi?: string;
  origem: number;
  nfci?: string;
  unidade: string;
  preco: number;
  precoCusto: number;
  estoque: number;
  taxRuleBaseId?: string | null;
}): ProdutoFormValues {
  return inputToFormValues({
    sku: p.sku,
    ean: p.ean,
    nome: p.nome,
    ncm: p.ncm,
    cest: p.cest,
    exTipi: p.exTipi,
    origem: p.origem,
    unidade: p.unidade,
    preco: p.preco,
    precoCusto: p.precoCusto,
    estoque: p.estoque,
    taxRuleBaseId: p.taxRuleBaseId ?? "",
  });
}

export function formatFieldErrors(fieldErrors?: Record<string, string[]>): string | undefined {
  if (!fieldErrors) return undefined;
  const msgs = Object.entries(fieldErrors).flatMap(([, v]) => v);
  return msgs.length > 0 ? msgs.join(" • ") : undefined;
}

export function parseProductForm(formData: FormData): ProductInput {
  const opt = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length > 0 ? v : undefined;
  };

  return {
    sku: String(formData.get("sku") ?? "").trim(),
    ean: opt("ean"),
    nome: String(formData.get("nome") ?? "").trim(),
    ncm: String(formData.get("ncm") ?? "").replace(/\D/g, ""),
    cest: String(formData.get("cest") ?? "").replace(/\D/g, ""),
    exTipi: opt("exTipi"),
    origem: Number(formData.get("origem") ?? 0),
    nfci: opt("nfci"),
    unidade: String(formData.get("unidade") ?? "UN").trim(),
    preco: Number(String(formData.get("preco") ?? "0").replace(",", ".")),
    precoCusto: Number(String(formData.get("precoCusto") ?? "0").replace(",", ".")),
    estoque: Number(String(formData.get("estoque") ?? "0").replace(",", ".")) || 0,
    taxRuleBaseId: taxRuleBaseIdFromFormValue(String(formData.get("taxRuleBaseId") ?? "")),
  };
}

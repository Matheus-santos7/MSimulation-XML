import type {
  TaxRuleDto,
  TaxRuleCatalogEntry,
} from "../fiscal-types";
import {
  authHeaders,
  buildApiUrl,
  getJson,
  mutateJson,
  readApiErrorPayload,
} from "./client";

export async function listTaxRules(): Promise<TaxRuleDto[]> {
  return getJson<TaxRuleDto[]>(buildApiUrl("/api/tax-rules"));
}

export async function listTaxRuleCatalog(): Promise<TaxRuleCatalogEntry[]> {
  return getJson<TaxRuleCatalogEntry[]>(buildApiUrl("/api/tax-rules/catalog"));
}

export type TaxRuleImportRow = {
  ruleId: string;
  nome: string;
  tipo: string;
  uf: string;
  cfop?: string;
  aliquota?: string;
  transactionType?: string;
  customerType?: string;
  origin?: string;
  payload?: Record<string, unknown>;
};

export type TaxRuleBulkUpsertResult = {
  created: number;
  updated: number;
  total: number;
};

export type TaxRuleSpreadsheetImportResult = TaxRuleBulkUpsertResult & {
  parseErrors?: { line: number; message: string }[];
};

export async function bulkUpsertTaxRules(rows: TaxRuleImportRow[]): Promise<TaxRuleBulkUpsertResult> {
  return mutateJson<TaxRuleBulkUpsertResult>(buildApiUrl("/api/tax-rules/bulk-upsert"), "POST", {
    rows,
  }) as Promise<TaxRuleBulkUpsertResult>;
}

/** Envia a planilha ML (.xlsx) para interpretação e persistência no backend. */
export async function importTaxRulesSpreadsheet(file: File): Promise<TaxRuleSpreadsheetImportResult> {
  const body = new FormData();
  body.append("file", file);

  const href = buildApiUrl("/api/tax-rules/import-spreadsheet");
  const res = await fetch(href, {
    method: "POST",
    headers: await authHeaders(),
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    throw new Error(payload.error);
  }

  return res.json() as Promise<TaxRuleSpreadsheetImportResult>;
}

export async function deleteAllTaxRules(): Promise<{ deleted: number }> {
  return mutateJson<{ deleted: number }>(buildApiUrl("/api/tax-rules"), "DELETE") as Promise<{
    deleted: number;
  }>;
}

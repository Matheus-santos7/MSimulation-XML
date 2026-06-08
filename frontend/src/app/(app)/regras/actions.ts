"use server";

import { revalidatePath } from "next/cache";
import { bulkUpsertTaxRules, deleteAllTaxRules, deleteTaxRuleGroup } from "@/lib/fiscal-api";
import { parseTaxRuleXlsx } from "@/lib/tax-rule-planilha";
import { validateSpreadsheetFile } from "@/lib/spreadsheet-upload";

export type TaxRuleImportState = {
  error?: string;
  success?: boolean;
  created?: number;
  updated?: number;
  total?: number;
  parseErrors?: { line: number; message: string }[];
};

export async function importarRegrasTributariasAction(
  _prev: TaxRuleImportState,
  formData: FormData,
): Promise<TaxRuleImportState> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Selecione um arquivo .xlsx" };
  const validation = await validateSpreadsheetFile(file);
  if (!validation.ok) return { error: validation.error };

  const parsed = parseTaxRuleXlsx(await file.arrayBuffer());
  if (parsed.rows.length === 0) {
    return { error: parsed.errors[0]?.message ?? "Nenhuma regra válida na planilha", parseErrors: parsed.errors };
  }

  try {
    const result = await bulkUpsertTaxRules(parsed.rows);
    revalidatePath("/regras");
    return {
      success: true,
      created: result.created,
      updated: result.updated,
      total: result.total,
      parseErrors: parsed.errors.length > 0 ? parsed.errors : undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao importar regras" };
  }
}

function revalidateTaxRulesPaths() {
  revalidatePath("/regras");
  revalidatePath("/produtos");
  revalidatePath("/produtos/novo");
  revalidatePath("/configuracoes-fiscais");
}

export async function excluirTodasRegrasTributariasAction(): Promise<{
  error?: string;
  deleted?: number;
}> {
  try {
    const result = await deleteAllTaxRules();
    revalidateTaxRulesPaths();
    return { deleted: result.deleted };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir regras" };
  }
}

export async function excluirRegraTributariaAction(
  baseId: string,
  origin: string,
): Promise<{ error?: string; nome?: string; deleted?: number }> {
  try {
    const result = await deleteTaxRuleGroup(baseId, origin);
    revalidateTaxRulesPaths();
    return { nome: result.nome, deleted: result.deleted };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir regra" };
  }
}

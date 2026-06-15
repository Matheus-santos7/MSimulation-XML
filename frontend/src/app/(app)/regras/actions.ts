"use server";

import { revalidatePath } from "next/cache";
import { deleteAllTaxRules, importTaxRulesSpreadsheet } from "@/lib/fiscal-api";
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

  try {
    const result = await importTaxRulesSpreadsheet(file);
    revalidatePath("/regras");
    return {
      success: true,
      created: result.created,
      updated: result.updated,
      total: result.total,
      parseErrors: result.parseErrors,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao importar regras" };
  }
}

function revalidateTaxRulesPaths() {
  revalidatePath("/regras");
  revalidatePath("/produtos");
  revalidatePath("/produtos");
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

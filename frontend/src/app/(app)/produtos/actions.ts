"use server";

import { revalidatePath } from "next/cache";
import {
  formatFieldErrors,
  inputToFormValues,
  parseProductForm,
  type ProdutoFormState,
} from "@/lib/produto-form";
import { ApiValidationError, createProduct, deleteProduct, importProductsSpreadsheet, updateProduct } from "@/lib/fiscal-api";

const MAX_PLANILHA_BYTES = 15 * 1024 * 1024;

function failureState(e: unknown, values: ReturnType<typeof inputToFormValues>): ProdutoFormState {
  const fieldErrors = e instanceof ApiValidationError ? e.fieldErrors : undefined;
  return {
    error: formatFieldErrors(fieldErrors) ?? (e instanceof Error ? e.message : "Erro ao salvar produto"),
    fieldErrors,
    values,
  };
}

export async function createProdutoAction(
  _prev: ProdutoFormState,
  formData: FormData,
): Promise<ProdutoFormState> {
  const parsed = parseProductForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await createProduct(parsed);
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/produtos");
  revalidatePath("/nfe");
  revalidatePath("/cte");
  revalidatePath("/");
  return { success: true };
}

export async function updateProdutoModalAction(
  id: string,
  _prev: ProdutoFormState,
  formData: FormData,
): Promise<ProdutoFormState> {
  const parsed = parseProductForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await updateProduct(id, parsed);
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/produtos");
  revalidatePath("/nfe");
  revalidatePath("/cte");
  revalidatePath("/");
  return { success: true };
}

export async function deleteProdutoAction(id: string): Promise<ProdutoFormState> {
  try {
    await deleteProduct(id);
    revalidatePath("/produtos");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir produto" };
  }
}

export type ProdutoPlanilhaImportResult = {
  error?: string;
  parseErrors?: { line: number; message: string }[];
  created?: number;
  updated?: number;
  failed?: { line: number; sku: string; error: string }[];
  total?: number;
};

export async function importProdutosPlanilhaAction(formData: FormData): Promise<ProdutoPlanilhaImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo .xlsx ou .csv" };
  }
  if (file.size > MAX_PLANILHA_BYTES) {
    return { error: "Arquivo excede o limite de 15 MB" };
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx")) {
    return { error: "Formato inválido. Envie um arquivo .xlsx ou .csv" };
  }

  try {
    const result = await importProductsSpreadsheet(file);
    revalidatePath("/produtos");
    revalidatePath("/nfe");
    revalidatePath("/cte");
    revalidatePath("/");
    return result;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erro ao importar planilha",
    };
  }
}

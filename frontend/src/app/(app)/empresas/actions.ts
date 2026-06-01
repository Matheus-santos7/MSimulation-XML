"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type EmpresaFormState,
  formatFieldErrors,
  inputToFormValues,
} from "@/lib/empresa-form";
import { enrichEmpresaFromCep } from "@/lib/enrich-empresa-cep";
import { ApiValidationError, createTenant, deleteTenant, updateTenant } from "@/lib/fiscal-api";
import { parseEmpresaForm } from "@/lib/parse-empresa-form";

function failureState(e: unknown, values: ReturnType<typeof inputToFormValues>): EmpresaFormState {
  const fieldErrors = e instanceof ApiValidationError ? e.fieldErrors : undefined;
  return {
    error: formatFieldErrors(fieldErrors) ?? (e instanceof Error ? e.message : "Erro ao salvar empresa"),
    fieldErrors,
    values,
  };
}

export async function createEmpresaAction(
  _prev: EmpresaFormState,
  formData: FormData,
): Promise<EmpresaFormState> {
  const parsed = parseEmpresaForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await createTenant(await enrichEmpresaFromCep(parsed));
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/empresas");
  revalidatePath("/");
  redirect("/empresas");
}

export async function updateEmpresaModalAction(
  id: string,
  _prev: EmpresaFormState,
  formData: FormData,
): Promise<EmpresaFormState> {
  const parsed = parseEmpresaForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await updateTenant(id, await enrichEmpresaFromCep(parsed));
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/empresas");
  revalidatePath("/");
  return { success: true };
}

export async function deleteEmpresaAction(id: string): Promise<EmpresaFormState> {
  try {
    await deleteTenant(id);
    revalidatePath("/empresas");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir empresa" };
  }
}

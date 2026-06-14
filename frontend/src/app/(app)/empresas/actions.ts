"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type EmpresaFormState,
  formatFieldErrors,
  inputToFormValues,
} from "@/lib/empresa-form";
import { enrichEmpresaFromCep } from "@/lib/enrich-empresa-cep";
import {
  ApiValidationError,
  createFilial,
  createTenant,
  deleteTenant,
  updateFilial,
  updateTenant,
} from "@/lib/fiscal-api";
import { parseEmpresaForm } from "@/lib/parse-empresa-form";
import type { TenantFilialInput } from "@/lib/fiscal-types";

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

export async function updateTenantPapeisAction(
  tenantId: string,
  input: { emitenteFiscalPrincipal: boolean; emitenteFiscalMatriz: boolean },
): Promise<{ error?: string; success?: boolean }> {
  try {
    await updateTenant(tenantId, input);
    revalidatePath("/empresas");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar papéis" };
  }
}

export async function createFilialAction(
  input: TenantFilialInput,
): Promise<{ error?: string }> {
  try {
    await createFilial(input);
    revalidatePath("/empresas/filiais");
    revalidatePath("/empresas");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao cadastrar filial" };
  }
}

export async function updateFilialAction(
  id: string,
  input: TenantFilialInput,
): Promise<{ error?: string }> {
  try {
    await updateFilial(id, input);
    revalidatePath("/empresas/filiais");
    revalidatePath("/empresas");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao atualizar filial" };
  }
}

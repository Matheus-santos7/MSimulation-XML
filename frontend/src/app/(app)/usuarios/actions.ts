"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  formatFieldErrors,
  inputToFormValues,
  parseUsuarioCreateForm,
  parseUsuarioUpdateForm,
  userToFormValues,
  type UsuarioFormState,
} from "@/lib/usuario-form";
import { ApiValidationError, createUser, deleteUser, updateUser } from "@/lib/fiscal-api";

function failureState(
  e: unknown,
  values: ReturnType<typeof inputToFormValues> | ReturnType<typeof userToFormValues>,
): UsuarioFormState {
  const fieldErrors = e instanceof ApiValidationError ? e.fieldErrors : undefined;
  return {
    error: formatFieldErrors(fieldErrors) ?? (e instanceof Error ? e.message : "Erro ao salvar usuário"),
    fieldErrors,
    values,
  };
}

export async function createUsuarioAction(
  _prev: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const parsed = parseUsuarioCreateForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await createUser(parsed);
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function updateUsuarioModalAction(
  id: string,
  _prev: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const parsed = parseUsuarioUpdateForm(formData);
  const values = {
    email: parsed.email ?? "",
    name: parsed.name ?? "",
    password: parsed.password ?? "",
  };
  try {
    await updateUser(id, parsed);
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/usuarios");
  return { success: true };
}

export async function deleteUsuarioAction(id: string): Promise<UsuarioFormState> {
  try {
    await deleteUser(id);
    revalidatePath("/usuarios");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir usuário" };
  }
}

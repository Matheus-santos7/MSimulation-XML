"use server";

import { revalidatePath } from "next/cache";
import {
  formatFieldErrors,
  parseUsuarioUpdateForm,
  type UsuarioFormState,
} from "@/lib/usuario-form";
import { ApiValidationError, updateUser } from "@/lib/fiscal-api";
import { getAuthMe } from "@/lib/auth/session";
import { rethrowNavigationError } from "@/lib/auth/navigation";

/** Atualiza nome/senha do usuário logado — domínio conta, não login. */
export async function updateMyAccountAction(
  _prev: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const me = await getAuthMe();
  if (!me) {
    return { error: "Sessão expirada. Entre novamente." };
  }

  const parsed = parseUsuarioUpdateForm(formData);
  const values = {
    email: me.email,
    name: parsed.name ?? "",
    password: parsed.password ?? "",
  };

  try {
    await updateUser(me.userId, {
      email: me.email,
      name: parsed.name,
      ...(parsed.password ? { password: parsed.password } : {}),
    });
  } catch (e) {
    rethrowNavigationError(e);
    const fieldErrors = e instanceof ApiValidationError ? e.fieldErrors : undefined;
    return {
      error:
        formatFieldErrors(fieldErrors) ?? (e instanceof Error ? e.message : "Erro ao salvar perfil"),
      fieldErrors,
      values,
    };
  }

  revalidatePath("/conta");
  revalidatePath("/", "layout");
  return { success: true, values };
}

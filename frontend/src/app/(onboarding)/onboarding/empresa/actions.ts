"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthApiError, onboardingTenantApi } from "@/lib/auth/api";
import { getAccessToken, setAuthSession } from "@/lib/auth/session";
import { enrichEmpresaFromCep } from "@/lib/enrich-empresa-cep";
import {
  type EmpresaFormState,
  formatFieldErrors,
  inputToFormValues,
} from "@/lib/empresa-form";
import { parseEmpresaForm } from "@/lib/parse-empresa-form";

export async function onboardingEmpresaAction(
  _prev: EmpresaFormState,
  formData: FormData,
): Promise<EmpresaFormState> {
  const parsed = parseEmpresaForm(formData);
  const values = inputToFormValues(parsed);
  const accessToken = await getAccessToken();

  if (!accessToken) {
    redirect("/login");
  }

  try {
    const session = await onboardingTenantApi(accessToken, await enrichEmpresaFromCep(parsed));
    await setAuthSession(session);
  } catch (e) {
    const fieldErrors = e instanceof AuthApiError ? e.fieldErrors : undefined;
    return {
      error:
        formatFieldErrors(fieldErrors) ??
        (e instanceof Error ? e.message : "Erro ao cadastrar empresa"),
      fieldErrors,
      values,
    };
  }

  revalidatePath("/");
  redirect("/");
}

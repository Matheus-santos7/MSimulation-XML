"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthApiError } from "@/lib/auth/api/client";
import { getAccessToken, setAuthSession } from "@/lib/auth/session";
import { formatFieldErrors, inputToFormValues } from "@/lib/empresa-form";
import { enrichEmpresaFromCep } from "@/lib/enrich-empresa-cep";
import { onboardingTenantApi } from "@/lib/onboarding/api";
import { parseEmpresaForm } from "@/lib/parse-empresa-form";
import { toUserFacingError } from "@/lib/user-facing-error";
import type { OnboardingEmpresaState } from "./types";

export async function onboardingEmpresaAction(
  _prev: OnboardingEmpresaState,
  formData: FormData,
): Promise<OnboardingEmpresaState> {
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
        toUserFacingError(e instanceof Error ? e.message : undefined, {
          fallback: "Erro ao cadastrar empresa. Tente novamente em instantes.",
        }),
      fieldErrors,
      values,
    };
  }

  revalidatePath("/");
  redirect("/");
}

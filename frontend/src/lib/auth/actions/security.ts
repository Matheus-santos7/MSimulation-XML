"use server";

import { revalidatePath } from "next/cache";
import { AuthApiError } from "@/lib/auth/api/client";
import { resendVerificationApi } from "@/lib/auth/api/session";
import { disable2faApi, enable2faApi, setup2faApi } from "@/lib/auth/api/two-factor";
import { resolveAccessToken } from "@/lib/auth/session";
import { toUserFacingError } from "@/lib/user-facing-error";
import type { ResendVerificationState, SecurityActionState } from "./types";

async function requireAccessToken(): Promise<string> {
  const token = await resolveAccessToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  return token;
}

export async function resendVerificationAction(
  _prev: ResendVerificationState | undefined,
): Promise<ResendVerificationState> {
  try {
    const token = await requireAccessToken();
    const result = await resendVerificationApi(token);
    return { success: result.message };
  } catch (e) {
    if (e instanceof AuthApiError) {
      return {
        error: toUserFacingError(e.message, {
          fallback: "Não foi possível reenviar o e-mail. Tente novamente.",
        }),
      };
    }
    return {
      error: toUserFacingError(e instanceof Error ? e.message : undefined, {
        fallback: "Não foi possível reenviar o e-mail. Tente novamente.",
      }),
    };
  }
}

export async function start2faSetupAction(): Promise<SecurityActionState> {
  try {
    const token = await requireAccessToken();
    const setup = await setup2faApi(token);
    return { setup };
  } catch (e) {
    return formatError(e);
  }
}

export async function enable2faAction(
  _prev: SecurityActionState | undefined,
  formData: FormData,
): Promise<SecurityActionState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Informe o código de 6 dígitos" };

  try {
    const token = await requireAccessToken();
    await enable2faApi(token, code);
    revalidatePath("/conta/seguranca");
    return { success: "Autenticação em duas etapas ativada." };
  } catch (e) {
    return formatError(e);
  }
}

export async function disable2faAction(
  _prev: SecurityActionState | undefined,
  formData: FormData,
): Promise<SecurityActionState> {
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!password || !code) {
    return { error: "Informe senha e código do autenticador" };
  }

  try {
    const token = await requireAccessToken();
    await disable2faApi(token, password, code);
    revalidatePath("/conta/seguranca");
    return { success: "Autenticação em duas etapas desativada." };
  } catch (e) {
    return formatError(e);
  }
}

function formatError(e: unknown): SecurityActionState {
  if (e instanceof AuthApiError) {
    return {
      error: toUserFacingError(e.message, {
        fallback: "Não foi possível atualizar a segurança da conta. Tente novamente.",
      }),
    };
  }
  return {
    error: toUserFacingError(e instanceof Error ? e.message : undefined, {
      fallback: "Não foi possível atualizar a segurança da conta. Tente novamente.",
    }),
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { AuthApiError, disable2faApi, enable2faApi, setup2faApi } from "@/lib/auth/api";
import { resolveAccessToken } from "@/lib/auth/session";
import type { SecurityActionState } from "./types";

async function requireAccessToken(): Promise<string> {
  const token = await resolveAccessToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  return token;
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
    return { error: e.message };
  }
  return { error: e instanceof Error ? e.message : "Falha na operação" };
}

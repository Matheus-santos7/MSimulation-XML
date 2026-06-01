"use server";

import {
  AuthApiError,
  forgotPasswordApi,
  isTwoFactorPending,
  loginApi,
  logoutApi,
  registerApi,
  resetPasswordApi,
  verify2faApi,
} from "@/lib/auth/api";
import {
  clearAuthSession,
  clearTwoFactorPending,
  getAccessToken,
  getRefreshToken,
  getTwoFactorPending,
  redirectAfterAuth,
  setAuthSession,
  setTwoFactorPending,
} from "@/lib/auth/session";
import { rethrowNavigationError } from "@/lib/auth/navigation";
import type {
  ForgotPasswordState,
  LoginState,
  RegisterState,
  ResetPasswordState,
  Verify2faState,
} from "./types";

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha" };
  }

  try {
    const result = await loginApi(email, password);
    if (!isTwoFactorPending(result)) {
      await setAuthSession(result);
      redirectAfterAuth(result);
      return {};
    }
    await clearAuthSession();
    await setTwoFactorPending(result.twoFactorToken);
    const { redirect } = await import("next/navigation");
    redirect("/login/verificar-2fa");
    return {};
  } catch (e) {
    return formatAuthError(e);
  }
}

export async function verify2faAction(
  _prev: Verify2faState | undefined,
  formData: FormData,
): Promise<Verify2faState> {
  const code = String(formData.get("code") ?? "").trim();
  const twoFactorToken =
    (await getTwoFactorPending()) ?? String(formData.get("twoFactorToken") ?? "").trim();

  if (!twoFactorToken) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!code) {
    return { error: "Informe o código de 6 dígitos" };
  }

  try {
    const session = await verify2faApi(twoFactorToken, code);
    await clearTwoFactorPending();
    await setAuthSession(session);
    redirectAfterAuth(session);
    return {};
  } catch (e) {
    return formatAuthError(e);
  }
}

export async function registerAction(
  _prev: RegisterState | undefined,
  formData: FormData,
): Promise<RegisterState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password) {
    return { error: "Informe e-mail e senha" };
  }

  try {
    const session = await registerApi({
      email,
      password,
      name: name.length > 0 ? name : undefined,
    });
    await setAuthSession(session);
    redirectAfterAuth(session);
    return {};
  } catch (e) {
    return formatAuthError(e);
  }
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Informe seu e-mail" };
  }

  try {
    const result = await forgotPasswordApi(email);
    return { success: result.message };
  } catch (e) {
    return formatAuthError(e);
  }
}

export async function resetPasswordAction(
  _prev: ResetPasswordState | undefined,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!token) {
    return { error: "Link inválido. Solicite um novo e-mail de redefinição." };
  }
  if (!password) {
    return { error: "Informe a nova senha" };
  }
  if (password !== passwordConfirm) {
    return { error: "As senhas não coincidem" };
  }

  try {
    const result = await resetPasswordApi(token, password);
    return { success: result.message };
  } catch (e) {
    return formatAuthError(e);
  }
}

export async function logoutAction(): Promise<void> {
  const [refreshToken, accessToken] = await Promise.all([getRefreshToken(), getAccessToken()]);
  await logoutApi(refreshToken, accessToken);
  await clearAuthSession();
  const { redirect } = await import("next/navigation");
  redirect("/login?session=expired");
}

function formatAuthError(e: unknown): { error: string; fieldErrors?: Record<string, string[]> } {
  rethrowNavigationError(e);
  if (e instanceof AuthApiError) {
    return { error: e.message, fieldErrors: e.fieldErrors };
  }
  return { error: e instanceof Error ? e.message : "Falha na autenticação" };
}

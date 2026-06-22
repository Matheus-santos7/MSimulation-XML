import { postAuthJson } from "./client";
import type { AuthSessionDto, LoginResultDto } from "../types";

export async function loginApi(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<LoginResultDto> {
  return postAuthJson<LoginResultDto>("/api/auth/login", {
    email,
    password,
    ...(captchaToken ? { captchaToken } : {}),
  });
}

export async function verify2faApi(
  twoFactorToken: string,
  code: string,
  captchaToken?: string,
): Promise<AuthSessionDto> {
  return postAuthJson<AuthSessionDto>("/api/auth/login/verify-2fa", {
    twoFactorToken,
    code,
    ...(captchaToken ? { captchaToken } : {}),
  });
}

export async function registerApi(input: {
  email: string;
  password: string;
  name?: string;
  captchaToken?: string;
}): Promise<AuthSessionDto> {
  return postAuthJson<AuthSessionDto>("/api/auth/register", input);
}

export async function verifyEmailApi(token: string): Promise<{ message: string }> {
  return postAuthJson<{ message: string }>("/api/auth/verify-email", { token });
}

export async function forgotPasswordApi(
  email: string,
  captchaToken?: string,
): Promise<{ message: string }> {
  return postAuthJson<{ message: string }>("/api/auth/forgot-password", {
    email,
    ...(captchaToken ? { captchaToken } : {}),
  });
}

export async function resetPasswordApi(
  token: string,
  password: string,
  code?: string,
): Promise<{ message: string }> {
  return postAuthJson<{ message: string }>("/api/auth/reset-password", {
    token,
    password,
    ...(code ? { code } : {}),
  });
}

import { postAuthJson } from "./client";
import type { AuthSessionDto, LoginResultDto } from "../types";

export async function loginApi(email: string, password: string): Promise<LoginResultDto> {
  return postAuthJson<LoginResultDto>("/api/auth/login", { email, password });
}

export async function verify2faApi(twoFactorToken: string, code: string): Promise<AuthSessionDto> {
  return postAuthJson<AuthSessionDto>("/api/auth/login/verify-2fa", { twoFactorToken, code });
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

export async function forgotPasswordApi(email: string): Promise<{ message: string }> {
  return postAuthJson<{ message: string }>("/api/auth/forgot-password", { email });
}

export async function resetPasswordApi(token: string, password: string): Promise<{ message: string }> {
  return postAuthJson<{ message: string }>("/api/auth/reset-password", { token, password });
}

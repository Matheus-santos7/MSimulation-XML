import { authBearerFetch } from "./client";
import type { TwoFactorSetupDto, TwoFactorStatusDto } from "../types";

export async function fetch2faStatus(accessToken: string): Promise<TwoFactorStatusDto> {
  return authBearerFetch(accessToken, "/api/auth/2fa/status");
}

export async function setup2faApi(accessToken: string): Promise<TwoFactorSetupDto> {
  return authBearerFetch(accessToken, "/api/auth/2fa/setup", { method: "POST", json: {} });
}

export async function enable2faApi(accessToken: string, code: string): Promise<{ enabled: boolean }> {
  return authBearerFetch(accessToken, "/api/auth/2fa/enable", { method: "POST", json: { code } });
}

export async function disable2faApi(
  accessToken: string,
  password: string,
  code: string,
): Promise<{ enabled: boolean }> {
  return authBearerFetch(accessToken, "/api/auth/2fa/disable", {
    method: "POST",
    json: { password, code },
  });
}

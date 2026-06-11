import type { mapTenant } from "../../org/tenant-mapper.js";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

/** Perfil autenticado sem tokens (ex.: GET /me). */
export type AuthUserResponse = {
  userId: string;
  tenantId: string | null;
  email: string;
  name?: string;
  tenant: ReturnType<typeof mapTenant> | null;
  needsOnboarding: boolean;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  role?: "ADMIN" | "MEMBER";
};

/** Sessão completa após login, registro, refresh ou onboarding. */
export type AuthSessionResponse = AuthUserResponse & AuthTokens;

/** Login interrompido — exige segundo fator antes de emitir sessão completa. */
export type TwoFactorPendingResponse = {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: string;
};

export type LoginResponse = AuthSessionResponse | TwoFactorPendingResponse;

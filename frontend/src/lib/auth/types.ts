import type { TenantDto } from "@/lib/fiscal-types";

/** Resposta de sessão após login, registro, refresh ou onboarding. */
export type AuthSessionDto = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  userId: string;
  tenantId: string | null;
  email: string;
  name?: string;
  tenant: TenantDto | null;
  needsOnboarding: boolean;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  role?: "ADMIN" | "MEMBER";
};

/** Login interrompido — exige segundo fator antes de emitir sessão completa. */
export type TwoFactorPendingDto = {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: string;
};

export type LoginResultDto = AuthSessionDto | TwoFactorPendingDto;

export function isTwoFactorPending(result: LoginResultDto): result is TwoFactorPendingDto {
  return "requiresTwoFactor" in result && result.requiresTwoFactor === true;
}

/** Perfil resolvido via GET /api/auth/me (sem tokens). */
export type AuthMeDto = {
  userId: string;
  tenantId: string | null;
  email: string;
  name?: string;
  tenant: TenantDto | null;
  needsOnboarding: boolean;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  role?: "ADMIN" | "MEMBER";
};

export type TwoFactorSetupDto = {
  secret: string;
  otpauthUrl: string;
  issuer: string;
};

export type TwoFactorStatusDto = {
  enabled: boolean;
};

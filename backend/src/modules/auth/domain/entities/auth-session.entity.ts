import type { TenantSummary, UserRole } from "./user.entity.js";

export type AccessTokenPayload = {
  userId: string;
  tenantId: string | null;
  tokenVersion: number;
  typ: "access";
};

export type TwoFactorPendingPayload = {
  userId: string;
  tokenVersion: number;
  typ: "2fa_pending";
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthUserResponse = {
  userId: string;
  tenantId: string | null;
  email: string;
  name?: string;
  tenant: TenantSummary | null;
  needsOnboarding: boolean;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  role?: UserRole;
};

export type AuthSessionResponse = AuthUserResponse & AuthTokens;

export type TwoFactorPendingResponse = {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: string;
};

export type LoginResponse = AuthSessionResponse | TwoFactorPendingResponse;

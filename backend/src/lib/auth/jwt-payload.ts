import type { mapTenant } from "../tenant-mapper.js";

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
  tenant: ReturnType<typeof mapTenant> | null;
  needsOnboarding: boolean;
  twoFactorEnabled: boolean;
};

export type AuthSessionResponse = AuthUserResponse & {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type TwoFactorPendingResponse = {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: string;
};

export type LoginResponse = AuthSessionResponse | TwoFactorPendingResponse;

export function buildAccessPayload(user: {
  id: string;
  tenantId: string | null;
  tokenVersion: number;
}): AccessTokenPayload {
  return {
    userId: user.id,
    tenantId: user.tenantId,
    tokenVersion: user.tokenVersion,
    typ: "access",
  };
}

export function buildTwoFactorPendingPayload(user: {
  id: string;
  tokenVersion: number;
}): TwoFactorPendingPayload {
  return {
    userId: user.id,
    tokenVersion: user.tokenVersion,
    typ: "2fa_pending",
  };
}

export function authSessionResponse(
  signAccess: (payload: AccessTokenPayload) => string,
  accessTtl: string,
  refreshToken: string,
  user: {
    id: string;
    email: string;
    name: string | null;
    tenantId: string | null;
    totpEnabledAt?: Date | null;
  },
  tenant: ReturnType<typeof mapTenant> | null,
  tokenVersion: number,
): AuthSessionResponse {
  const accessToken = signAccess(buildAccessPayload({ id: user.id, tenantId: user.tenantId, tokenVersion }));
  return {
    accessToken,
    refreshToken,
    expiresIn: accessTtl,
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name ?? undefined,
    tenant,
    needsOnboarding: user.tenantId === null,
    twoFactorEnabled: user.totpEnabledAt != null,
  };
}

export function twoFactorPendingResponse(twoFactorToken: string, ttl: string): TwoFactorPendingResponse {
  return {
    requiresTwoFactor: true,
    twoFactorToken,
    expiresIn: ttl,
  };
}

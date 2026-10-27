import type { AuthUserWithTenant } from "../../user/user.types.js";

export function userFixture(overrides: Partial<AuthUserWithTenant> = {}): AuthUserWithTenant {
  return {
    id: "user-1",
    email: "ana@example.com",
    name: "Ana",
    password: "scrypt$hash",
    tenantId: "tenant-1",
    role: "ADMIN",
    tokenVersion: 3,
    emailVerifiedAt: new Date(),
    totpEnabledAt: null,
    totpSecretEnc: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    tenant: null,
    ...overrides,
  };
}

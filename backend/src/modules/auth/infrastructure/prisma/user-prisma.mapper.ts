import type { Tenant, User } from "../../../../generated/prisma/client.js";
import type { AuthUser, AuthUserWithTenant, TenantSummary } from "../../domain/entities/user.entity.js";
import { mapTenant } from "../../../org/infrastructure/prisma/tenant-prisma.mapper.js";

export function mapAuthUser(row: User): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    password: row.password,
    tenantId: row.tenantId,
    role: row.role,
    tokenVersion: row.tokenVersion,
    emailVerifiedAt: row.emailVerifiedAt,
    totpEnabledAt: row.totpEnabledAt,
    totpSecretEnc: row.totpSecretEnc,
    failedLoginAttempts: row.failedLoginAttempts,
    lockedUntil: row.lockedUntil,
  };
}

export function mapTenantSummary(row: Tenant): TenantSummary {
  return mapTenant(row);
}

export function mapAuthUserWithTenant(row: User & { tenant: Tenant | null }): AuthUserWithTenant {
  return {
    ...mapAuthUser(row),
    tenant: row.tenant ? mapTenantSummary(row.tenant) : null,
  };
}

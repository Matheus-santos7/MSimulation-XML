import type { User as PrismaUser } from "../../../../generated/prisma/client.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";

export function mapOrgUserFromPrisma(row: PrismaUser): OrgUser {
  return {
    id: row.id,
    tenantId: row.tenantId!,
    email: row.email,
    name: row.name ?? undefined,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

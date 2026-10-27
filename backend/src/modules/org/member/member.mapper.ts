import type { User as PrismaUser } from "../../../generated/prisma/client.js";
import type { OrgUser } from "./member.types.js";

export function mapOrgUser(row: PrismaUser): OrgUser {
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

import type { User, UserRole } from "../../generated/prisma/client.js";

export type UserDto = {
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export function mapUser(row: User): UserDto {
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

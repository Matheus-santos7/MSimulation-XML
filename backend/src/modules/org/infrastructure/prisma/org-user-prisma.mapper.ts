import type { User as PrismaUser } from "../../../../generated/prisma/client.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { mapUser } from "../../../../lib/org/user-mapper.js";

export function mapOrgUserFromPrisma(row: PrismaUser): OrgUser {
  return mapUser(row);
}

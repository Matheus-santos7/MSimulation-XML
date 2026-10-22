import { Injectable } from "@nestjs/common";
import { isPrismaUniqueError } from "../../../lib/db/prisma-errors.js";
import { runInTransaction } from "../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { OrgError } from "../errors/org.errors.js";
import { mapOrgUser } from "./member.mapper.js";
import type { CreateMemberData, OrgUser, UpdateMemberData } from "./member.types.js";

/** Usuários da empresa. Toda leitura filtra por `tenantId` (além da RLS). */
@Injectable()
export class MemberRepository {
  private get db() {
    return getDbClient();
  }

  async listByTenant(tenantId: string): Promise<OrgUser[]> {
    const rows = await this.db.user.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    });
    return rows.map(mapOrgUser);
  }

  async findById(id: string, tenantId: string): Promise<OrgUser | null> {
    const row = await this.db.user.findFirst({ where: { id, tenantId } });
    return row ? mapOrgUser(row) : null;
  }

  async create(tenantId: string, data: CreateMemberData): Promise<OrgUser> {
    try {
      const row = await this.db.user.create({
        data: {
          tenantId,
          email: data.email,
          name: data.name ?? null,
          password: data.passwordHash,
        },
      });
      return mapOrgUser(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new OrgError.MemberConflict("E-mail já cadastrado");
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateMemberData): Promise<OrgUser | null> {
    const existing = await this.db.user.findUnique({ where: { id } });
    if (!existing) return null;

    try {
      const row = await runInTransaction(this.db, async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data: {
            ...(data.email !== undefined ? { email: data.email } : {}),
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.passwordHash !== undefined
              ? { password: data.passwordHash, tokenVersion: { increment: 1 } }
              : {}),
          },
        });
        if (data.passwordHash !== undefined) {
          await tx.userSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return updated;
      });
      return mapOrgUser(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new OrgError.MemberConflict("E-mail já cadastrado");
      }
      throw error;
    }
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.db.user.count({ where: { tenantId } });
  }

  async delete(id: string): Promise<void> {
    await this.db.user.delete({ where: { id } });
  }
}

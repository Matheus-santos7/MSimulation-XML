import type { PrismaClient } from "../generated/prisma/client.js";
import { mapUser } from "../lib/user-mapper.js";
import { hashPassword } from "../lib/auth/password.js";
import type { userCreateBody, userUpdateBody } from "../schemas/user.js";
import type { z } from "zod";

type CreateInput = z.infer<typeof userCreateBody>;
type UpdateInput = z.infer<typeof userUpdateBody>;

export class UserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserConflictError";
  }
}

export class UserForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserForbiddenError";
  }
}

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string) {
    const rows = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    });
    return rows.map(mapUser);
  }

  async getById(id: string, tenantId: string) {
    const row = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    return row ? mapUser(row) : null;
  }

  async create(tenantId: string, data: CreateInput) {
    try {
      const row = await this.prisma.user.create({
        data: {
          tenantId,
          email: data.email,
          name: data.name ?? null,
          password: await hashPassword(data.password),
        },
      });
      return mapUser(row);
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        throw new UserConflictError("E-mail já cadastrado");
      }
      throw e;
    }
  }

  async update(id: string, tenantId: string, data: UpdateInput) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;

    try {
      const passwordHash =
        data.password !== undefined ? await hashPassword(data.password) : undefined;

      const row = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data: {
            ...(data.email !== undefined ? { email: data.email } : {}),
            ...(data.name !== undefined ? { name: data.name ?? null } : {}),
            ...(passwordHash !== undefined
              ? { password: passwordHash, tokenVersion: { increment: 1 } }
              : {}),
          },
        });
        if (passwordHash !== undefined) {
          await tx.userSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return updated;
      });
      return mapUser(row);
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        throw new UserConflictError("E-mail já cadastrado");
      }
      throw e;
    }
  }

  async remove(id: string, tenantId: string, currentUserId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return false;

    if (existing.id === currentUserId) {
      throw new UserForbiddenError("Não é possível excluir o usuário logado");
    }

    const count = await this.prisma.user.count({ where: { tenantId } });
    if (count <= 1) {
      throw new UserForbiddenError("A empresa precisa ter ao menos um usuário");
    }

    await this.prisma.user.delete({ where: { id } });
    return true;
  }
}

function isPrismaUniqueError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}

import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "../../generated/prisma/client.js";
import { requireEmailVerification } from "../../lib/auth/config.js";

export class AdminRequiredError extends Error {
  constructor() {
    super("Apenas administradores podem executar esta ação");
    this.name = "AdminRequiredError";
  }
}

export class EmailNotVerifiedError extends Error {
  constructor() {
    super("Confirme seu e-mail antes de continuar");
    this.name = "EmailNotVerifiedError";
  }
}

export type AuthenticatedUser = {
  userId: string;
  tenantId: string | null;
  tokenVersion: number;
  typ: "access";
  role: UserRole;
  emailVerified: boolean;
};

/** Exige empresa cadastrada (tenantId no JWT após refresh do usuário). */
export async function requireTenantHook(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user.tenantId) {
    return reply.status(403).send({ error: "Cadastre uma empresa para continuar" });
  }
}

/** Exige e-mail verificado para operações de negócio. */
export async function requireEmailVerifiedHook(request: FastifyRequest, reply: FastifyReply) {
  if (!requireEmailVerification()) return;

  const user = request.user as AuthenticatedUser;
  if (!user.emailVerified) {
    return reply.status(403).send({ error: "Confirme seu e-mail antes de continuar" });
  }
}

/** Exige papel ADMIN no tenant. */
export async function requireAdminHook(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as AuthenticatedUser;
  if (user.role !== "ADMIN") {
    return reply.status(403).send({ error: "Apenas administradores podem executar esta ação" });
  }
}

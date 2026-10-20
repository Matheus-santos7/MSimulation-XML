import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ACCESS_MESSAGES,
  isAdmin,
  isEmailVerificationPending,
  isTenantMissing,
  type AuthenticatedUser,
} from "../../lib/auth/access-control.js";

export type { AuthenticatedUser };

export class AdminRequiredError extends Error {
  constructor() {
    super(ACCESS_MESSAGES.adminRequired);
    this.name = "AdminRequiredError";
  }
}

export class EmailNotVerifiedError extends Error {
  constructor() {
    super(ACCESS_MESSAGES.emailNotVerified);
    this.name = "EmailNotVerifiedError";
  }
}

/** Exige empresa cadastrada (tenantId no JWT após refresh do usuário). */
export async function requireTenantHook(request: FastifyRequest, reply: FastifyReply) {
  if (isTenantMissing(request.user)) {
    return reply.status(403).send({ error: ACCESS_MESSAGES.tenantRequired });
  }
}

/** Exige e-mail verificado para operações de negócio. */
export async function requireEmailVerifiedHook(request: FastifyRequest, reply: FastifyReply) {
  if (isEmailVerificationPending(request.user)) {
    return reply.status(403).send({ error: ACCESS_MESSAGES.emailNotVerified });
  }
}

/** Exige papel ADMIN no tenant. */
export async function requireAdminHook(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdmin(request.user)) {
    return reply.status(403).send({ error: ACCESS_MESSAGES.adminRequired });
  }
}

import type { FastifyRequest } from "fastify";
import type { PrismaClient, UserRole } from "../../generated/prisma/client.js";
import { isEmailVerified, requireEmailVerification } from "./config.js";
import type { AccessTokenPayload } from "./types/index.js";

/**
 * Regras de acesso da API (JWT, tenant, e-mail, papel), compartilhadas entre os
 * hooks Fastify legados e os guards do Nest. As mensagens fazem parte do contrato.
 */
export const ACCESS_MESSAGES = {
  unauthorized: "Não autorizado. Token ausente ou inválido.",
  invalidTokenType: "Token inválido para esta operação.",
  sessionEnded: "Sessão encerrada. Entre novamente.",
  tenantRequired: "Cadastre uma empresa para continuar",
  emailNotVerified: "Confirme seu e-mail antes de continuar",
  adminRequired: "Apenas administradores podem executar esta ação",
} as const;

export type AuthenticatedUser = {
  userId: string;
  tenantId: string | null;
  tokenVersion: number;
  typ: "access";
  role: UserRole;
  emailVerified: boolean;
};

export type AuthenticationResult = { user: AuthenticatedUser } | { error: string };

/** Valida o Bearer e confere `tokenVersion` no banco; devolve o usuário ou a mensagem de 401. */
export async function authenticateRequest(
  prisma: Pick<PrismaClient, "user">,
  request: FastifyRequest,
): Promise<AuthenticationResult> {
  try {
    await request.jwtVerify<AccessTokenPayload>();
  } catch {
    return { error: ACCESS_MESSAGES.unauthorized };
  }

  const payload = request.user;
  if (payload.typ !== "access") {
    return { error: ACCESS_MESSAGES.invalidTokenType };
  }

  const row = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true, tenantId: true, role: true, emailVerifiedAt: true },
  });

  if (!row || row.tokenVersion !== payload.tokenVersion) {
    return { error: ACCESS_MESSAGES.sessionEnded };
  }

  return {
    user: {
      ...payload,
      tenantId: row.tenantId,
      role: row.role,
      emailVerified: isEmailVerified(row.emailVerifiedAt),
    },
  };
}

export function isTenantMissing(user: AuthenticatedUser): boolean {
  return !user.tenantId;
}

export function isEmailVerificationPending(user: AuthenticatedUser): boolean {
  return requireEmailVerification() && !user.emailVerified;
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === "ADMIN";
}

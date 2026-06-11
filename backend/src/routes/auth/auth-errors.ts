import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import { CaptchaVerificationError } from "../../lib/auth/turnstile.js";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from "../../lib/db/errors.js";
import {
  AuthConflictError,
  AuthStateError,
  AuthTooManyRequestsError,
  AuthUnauthorizedError,
  EmailDeliveryError,
  EmailVerificationInvalidError,
  PasswordResetInvalidError,
  TwoFactorRequiredError,
} from "../../services/auth/index.js";
import { TenantConflictError } from "../../services/org/tenant-service.js";

/** Mapeia erros de domínio de auth para respostas HTTP consistentes. */
export function handleAuthError(e: unknown, reply: FastifyReply) {
  if (e instanceof ZodError) {
    const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fieldErrors).flat()[0];
    return reply.status(400).send({
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    });
  }
  if (e instanceof AuthUnauthorizedError) {
    return reply.status(401).send({ error: e.message });
  }
  if (e instanceof AuthTooManyRequestsError) {
    return reply.status(429).send({ error: e.message });
  }
  if (e instanceof TwoFactorRequiredError) {
    return reply.status(401).send({ error: e.message });
  }
  if (e instanceof AuthConflictError) {
    return reply.status(409).send({ error: e.message });
  }
  if (e instanceof AuthStateError) {
    return reply.status(400).send({ error: e.message });
  }
  if (e instanceof TenantConflictError) {
    return reply.status(409).send({ error: e.message });
  }
  if (e instanceof PasswordResetInvalidError) {
    return reply.status(400).send({ error: e.message });
  }
  if (e instanceof EmailDeliveryError) {
    return reply.status(503).send({ error: "Não foi possível enviar o e-mail. Tente novamente em instantes." });
  }
  if (e instanceof CaptchaVerificationError) {
    return reply.status(400).send({ error: e.message });
  }
  if (e instanceof EmailVerificationInvalidError) {
    return reply.status(400).send({ error: e.message });
  }
  if (isDatabaseUnavailableError(e)) {
    return reply.status(503).send({ error: DATABASE_UNAVAILABLE_MESSAGE });
  }
  return reply.status(500).send({
    error: "Não foi possível completar a operação. Tente novamente em instantes.",
  });
}

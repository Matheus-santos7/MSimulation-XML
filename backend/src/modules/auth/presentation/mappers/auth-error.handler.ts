import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import { CaptchaVerificationError } from "../../../../lib/auth/turnstile.js";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from "../../../../lib/http/error-handler.js";
import { TenantConflictError } from "../../../org/index.js";
import { AuthConflictError } from "../../domain/errors/auth-conflict.error.js";
import { AuthStateError } from "../../domain/errors/auth-state.error.js";
import { AuthTooManyRequestsError } from "../../domain/errors/auth-too-many-requests.error.js";
import { AuthUnauthorizedError } from "../../domain/errors/auth-unauthorized.error.js";
import { EmailDeliveryError } from "../../domain/errors/email-delivery.error.js";
import { EmailVerificationInvalidError } from "../../domain/errors/email-verification-invalid.error.js";
import { PasswordResetInvalidError } from "../../domain/errors/password-reset-invalid.error.js";
import { TwoFactorRequiredError } from "../../domain/errors/two-factor-required.error.js";

/** Maps auth domain errors to consistent HTTP responses. */
export function handleAuthError(error: unknown, reply: FastifyReply) {
  if (error instanceof ZodError) {
    const fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fieldErrors).flat()[0];
    return reply.status(400).send({
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    });
  }
  if (error instanceof AuthUnauthorizedError) {
    return reply.status(401).send({ error: error.message });
  }
  if (error instanceof AuthTooManyRequestsError) {
    return reply.status(429).send({ error: error.message });
  }
  if (error instanceof TwoFactorRequiredError) {
    return reply.status(401).send({ error: error.message });
  }
  if (error instanceof AuthConflictError) {
    return reply.status(409).send({ error: error.message });
  }
  if (error instanceof AuthStateError) {
    return reply.status(400).send({ error: error.message });
  }
  if (error instanceof TenantConflictError) {
    return reply.status(409).send({ error: error.message });
  }
  if (error instanceof PasswordResetInvalidError) {
    return reply.status(400).send({ error: error.message });
  }
  if (error instanceof EmailDeliveryError) {
    return reply.status(503).send({ error: "Não foi possível enviar o e-mail. Tente novamente em instantes." });
  }
  if (error instanceof CaptchaVerificationError) {
    return reply.status(400).send({ error: error.message });
  }
  if (error instanceof EmailVerificationInvalidError) {
    return reply.status(400).send({ error: error.message });
  }
  if (isDatabaseUnavailableError(error)) {
    return reply.status(503).send({ error: DATABASE_UNAVAILABLE_MESSAGE });
  }
  return reply.status(500).send({
    error: "Não foi possível completar a operação. Tente novamente em instantes.",
  });
}

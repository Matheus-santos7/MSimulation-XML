import type { FastifyBaseLogger } from "fastify";
import { ZodError } from "zod";
import { CaptchaVerificationError } from "../../../../lib/auth/turnstile.js";
import { zodValidationErrorResponse } from "../../../../lib/http/domain-errors.js";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from "../../../../lib/http/error-handler.js";
import type { ErrorResponse } from "../../../../lib/http/http-error.js";
import { TenantConflictError } from "../../../org/index.js";
import { AuthConflictError } from "../../domain/errors/auth-conflict.error.js";
import { AuthStateError } from "../../domain/errors/auth-state.error.js";
import { AuthTooManyRequestsError } from "../../domain/errors/auth-too-many-requests.error.js";
import { AuthUnauthorizedError } from "../../domain/errors/auth-unauthorized.error.js";
import { EmailDeliveryError } from "../../domain/errors/email-delivery.error.js";
import { EmailVerificationInvalidError } from "../../domain/errors/email-verification-invalid.error.js";
import { PasswordResetInvalidError } from "../../domain/errors/password-reset-invalid.error.js";
import { TwoFactorRequiredError } from "../../domain/errors/two-factor-required.error.js";

/** Erros de domínio do auth que respondem com a própria mensagem. */
const AUTH_ERROR_STATUS: ReadonlyArray<readonly [new (...args: never[]) => Error, number]> = [
  [AuthUnauthorizedError, 401],
  [AuthTooManyRequestsError, 429],
  [TwoFactorRequiredError, 401],
  [AuthConflictError, 409],
  [AuthStateError, 400],
  [TenantConflictError, 409],
  [PasswordResetInvalidError, 400],
  [CaptchaVerificationError, 400],
  [EmailVerificationInvalidError, 400],
];

/** Maps auth domain errors to consistent HTTP responses. */
export function resolveAuthError(error: unknown, log: FastifyBaseLogger): ErrorResponse {
  if (error instanceof ZodError) {
    return zodValidationErrorResponse(error);
  }

  const mapped = AUTH_ERROR_STATUS.find(([type]) => error instanceof type);
  if (mapped) {
    return { status: mapped[1], body: { error: (error as Error).message } };
  }

  if (error instanceof EmailDeliveryError) {
    return { status: 503, body: { error: "Não foi possível enviar o e-mail. Tente novamente em instantes." } };
  }
  if (isDatabaseUnavailableError(error)) {
    log.error({ err: error }, "Banco de dados indisponível (auth)");
    return { status: 503, body: { error: DATABASE_UNAVAILABLE_MESSAGE } };
  }

  log.error({ err: error }, "Erro não tratado (auth)");
  return {
    status: 500,
    body: { error: "Não foi possível completar a operação. Tente novamente em instantes." },
  };
}

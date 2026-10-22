import { Catch, HttpException } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import { ZodError } from "zod";
import { CaptchaVerificationError } from "../../../lib/auth/turnstile.js";
import { zodValidationErrorResponse } from "../../../lib/http/domain-errors.js";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from "../../../lib/http/error-handler.js";
import { HttpError, type ErrorResponse } from "../../../lib/http/http-error.js";
import { ApiExceptionFilter } from "../../../nest/http/api-exception.filter.js";

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;

const AUTH_UNEXPECTED_ERROR_MESSAGE =
  "Não foi possível completar a operação. Tente novamente em instantes.";

/** Erros com status HTTP próprio (exceções Nest, guard JWT, rate limit, parser) seguem o contrato global. */
function carriesHttpStatus(exception: unknown): boolean {
  if (exception instanceof HttpError || exception instanceof HttpException) return true;
  if (typeof exception !== "object" || exception === null) return false;

  return typeof (exception as { statusCode?: unknown }).statusCode === "number";
}

/**
 * Filtro das rotas de auth. Difere do global em três pontos do contrato:
 * - captcha recusado (lib) responde 400;
 * - schema Zod do onboarding (org) responde 400 `{ error, details }`;
 * - erro inesperado responde 500 com mensagem orientativa, não a genérica.
 */
@Catch()
export class AuthErrorFilter extends ApiExceptionFilter {
  protected override resolve(exception: unknown, log: FastifyBaseLogger): ErrorResponse {
    if (carriesHttpStatus(exception)) return super.resolve(exception, log);
    if (exception instanceof ZodError) return zodValidationErrorResponse(exception);
    if (exception instanceof CaptchaVerificationError) {
      return { status: HTTP_BAD_REQUEST, body: { error: exception.message } };
    }
    if (isDatabaseUnavailableError(exception)) {
      log.error({ err: exception }, "Banco de dados indisponível (auth)");

      return { status: HTTP_SERVICE_UNAVAILABLE, body: { error: DATABASE_UNAVAILABLE_MESSAGE } };
    }

    log.error({ err: exception }, "Erro não tratado (auth)");

    return { status: HTTP_INTERNAL_SERVER_ERROR, body: { error: AUTH_UNEXPECTED_ERROR_MESSAGE } };
  }
}

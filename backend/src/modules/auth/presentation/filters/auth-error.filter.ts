import { Catch, HttpException } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import { HttpError, type ErrorResponse } from "../../../../lib/http/http-error.js";
import { ApiExceptionFilter } from "../../../../nest/http/api-exception.filter.js";
import { resolveAuthError } from "../mappers/auth-error.handler.js";

/** Erros com status HTTP próprio (guard JWT, rate limit, parser do Fastify) seguem o contrato global. */
function carriesHttpStatus(exception: unknown): boolean {
  if (exception instanceof HttpError || exception instanceof HttpException) return true;
  if (typeof exception !== "object" || exception === null) return false;

  return typeof (exception as { statusCode?: unknown }).statusCode === "number";
}

/**
 * Erros de domínio do auth viram 400/401/409/429/503 (`resolveAuthError`) e o resto
 * responde 500 com mensagem orientativa, não a genérica global.
 */
@Catch()
export class AuthErrorFilter extends ApiExceptionFilter {
  protected override resolve(exception: unknown, log: FastifyBaseLogger): ErrorResponse {
    return carriesHttpStatus(exception)
      ? super.resolve(exception, log)
      : resolveAuthError(exception, log);
  }
}

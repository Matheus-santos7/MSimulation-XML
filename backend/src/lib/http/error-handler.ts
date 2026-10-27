import type { FastifyBaseLogger, FastifyError } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { zodValidationErrorResponse } from "./domain-errors.js";
import type { ErrorResponse } from "./http-error.js";

const GENERIC_INTERNAL_ERROR = "Erro interno do servidor";

export const DATABASE_UNAVAILABLE_MESSAGE = "Banco de dados indisponível";

/** Indisponibilidade do Postgres (daemon parado, rede, credenciais, timeout Neon). */
export function isDatabaseUnavailableError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      e.code === "P1001" ||
      e.code === "P1000" ||
      e.code === "ECONNREFUSED" ||
      e.code === "ETIMEDOUT" ||
      /ETIMEDOUT|timeout/i.test(e.message)
    );
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (e instanceof Error && /ECONNREFUSED|ETIMEDOUT|Can't reach database|P1001/i.test(e.message)) {
    return true;
  }
  return false;
}

/**
 * Traduz qualquer erro não tratado em status + `{ error }`.
 * Usado pelo `ApiExceptionFilter` (rotas Nest e erros do Fastify fora do pipeline).
 */
export function resolveErrorResponse(error: unknown, log: FastifyBaseLogger): ErrorResponse {
  if (error instanceof ZodError) {
    return zodValidationErrorResponse(error);
  }

  if (isDatabaseUnavailableError(error)) {
    log.error({ err: error }, "Banco de dados indisponível");
    return { status: 503, body: { error: DATABASE_UNAVAILABLE_MESSAGE } };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    log.error({ err: error, code: error.code }, "Erro Prisma");
    if (error.code === "P2002") {
      return { status: 409, body: { error: "Registro duplicado" } };
    }
    if (error.code === "P2025") {
      return { status: 404, body: { error: "Registro não encontrado" } };
    }
    return { status: 500, body: { error: GENERIC_INTERNAL_ERROR } };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    log.error({ err: error }, "Validação Prisma");
    return { status: 400, body: { error: "Dados inválidos" } };
  }

  // Erros do Fastify e do rate limit chegam como objetos com `statusCode` (nem sempre `Error`).
  const { statusCode, message } = (error ?? {}) as Partial<FastifyError>;
  const status = statusCode ?? 500;
  if (status >= 500) {
    log.error({ err: error }, "Erro não tratado");
    return { status: 500, body: { error: GENERIC_INTERNAL_ERROR } };
  }

  return { status, body: { error: message || GENERIC_INTERNAL_ERROR } };
}

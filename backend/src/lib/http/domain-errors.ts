import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import type { ErrorResponse } from "./http-error.js";

/** Corpo `{ error, details }` de validação Zod (o frontend lê em `ApiValidationError`). */
export function zodValidationErrorResponse(error: ZodError): ErrorResponse {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
  const first = Object.values(fieldErrors).flat()[0];

  return {
    status: 400,
    body: {
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    },
  };
}

export function sendZodValidationError(reply: FastifyReply, error: ZodError): void {
  const { status, body } = zodValidationErrorResponse(error);
  void reply.status(status).send(body);
}

export type DomainErrorWithStatus = Error & { status: number };

export type StatusErrorConstructor = new (
  message: string,
  status?: number,
) => DomainErrorWithStatus;

/** Converte erros de domínio com `.status` em JSON `{ error }`. */
export function replyStatusDomainError(
  reply: FastifyReply,
  e: unknown,
  types: StatusErrorConstructor[],
): boolean {
  const response = resolveStatusDomainError(e, types);
  if (!response) return false;

  void reply.status(response.status).send(response.body);
  return true;
}

function resolveStatusDomainError(
  e: unknown,
  types: readonly StatusErrorConstructor[],
): ErrorResponse | null {
  for (const Ctor of types) {
    if (e instanceof Ctor) {
      return { status: e.status, body: { error: e.message } };
    }
  }
  return null;
}

export type RouteErrorMapping = {
  type: new (...args: never[]) => Error;
  status: number;
  toBody?: (error: Error) => Record<string, unknown>;
};

export type RouteErrorOptions = {
  mappings?: readonly RouteErrorMapping[];
  statusErrors?: readonly StatusErrorConstructor[];
};

/** Resolve ZodError e erros de domínio mapeados por rota; `null` quando o erro não é mapeado. */
export function resolveRouteError(e: unknown, options: RouteErrorOptions): ErrorResponse | null {
  if (e instanceof ZodError) {
    return zodValidationErrorResponse(e);
  }

  for (const mapping of options.mappings ?? []) {
    if (e instanceof mapping.type) {
      const body = mapping.toBody ? mapping.toBody(e) : { error: e.message };
      return { status: mapping.status, body: body as ErrorResponse["body"] };
    }
  }

  return options.statusErrors ? resolveStatusDomainError(e, options.statusErrors) : null;
}

/**
 * Trata ZodError e erros de domínio mapeados por rota.
 * Retorna true se a resposta HTTP foi enviada; false para re-lançar.
 */
export function handleRouteError(reply: FastifyReply, e: unknown, options: RouteErrorOptions): boolean {
  const response = resolveRouteError(e, options);
  if (!response) return false;

  void reply.status(response.status).send(response.body);
  return true;
}

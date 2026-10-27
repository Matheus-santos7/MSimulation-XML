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

export type DomainErrorWithStatus = Error & { status: number };

export type StatusErrorConstructor = new (
  message: string,
  status?: number,
) => DomainErrorWithStatus;

export type RouteErrorMapping = {
  type: new (...args: never[]) => Error;
  status: number;
  toBody?: (error: Error) => Record<string, unknown>;
};

export type RouteErrorOptions = {
  /** Erro de domínio → status fixo (e corpo opcional). */
  mappings?: readonly RouteErrorMapping[];
  /** Erros de domínio que carregam o próprio `.status`. */
  statusErrors?: readonly StatusErrorConstructor[];
};

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

/**
 * Resolve ZodError e erros de domínio mapeados por rota (usado pelo `RouteErrorFilter`).
 * Devolve `null` quando o erro não é mapeado e deve seguir para o contrato global.
 */
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

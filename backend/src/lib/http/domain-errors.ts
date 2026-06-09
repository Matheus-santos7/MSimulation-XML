import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

export function sendZodValidationError(reply: FastifyReply, error: ZodError): void {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
  const first = Object.values(fieldErrors).flat()[0];
  void reply.status(400).send({
    error: first ?? "Dados inválidos",
    details: fieldErrors,
  });
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
  for (const Ctor of types) {
    if (e instanceof Ctor) {
      void reply.status(e.status).send({ error: e.message });
      return true;
    }
  }
  return false;
}

export type RouteErrorMapping = {
  type: new (...args: never[]) => Error;
  status: number;
  toBody?: (error: Error) => Record<string, unknown>;
};

/**
 * Trata ZodError e erros de domínio mapeados por rota.
 * Retorna true se a resposta HTTP foi enviada; false para re-lançar.
 */
export function handleRouteError(
  reply: FastifyReply,
  e: unknown,
  options: {
    mappings?: RouteErrorMapping[];
    statusErrors?: StatusErrorConstructor[];
  },
): boolean {
  if (e instanceof ZodError) {
    sendZodValidationError(reply, e);
    return true;
  }

  for (const mapping of options.mappings ?? []) {
    if (e instanceof mapping.type) {
      const body = mapping.toBody ? mapping.toBody(e) : { error: e.message };
      void reply.status(mapping.status).send(body);
      return true;
    }
  }

  if (options.statusErrors && replyStatusDomainError(reply, e, options.statusErrors)) {
    return true;
  }

  return false;
}

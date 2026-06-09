import type { FastifyReply } from "fastify";

/** Converte erros de domínio (*Error com `.status`) em JSON `{ error }` sem vazar stack. */
export function replyDomainError(
  reply: FastifyReply,
  e: unknown,
  types: Array<new (message: string, status?: number) => Error & { status: number }>,
): boolean {
  for (const Ctor of types) {
    if (e instanceof Ctor) {
      void reply.status(e.status).send({ error: e.message });
      return true;
    }
  }
  return false;
}

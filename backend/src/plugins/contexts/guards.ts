import type { FastifyReply, FastifyRequest } from "fastify";

/** Exige empresa cadastrada (tenantId no JWT após refresh do usuário). */
export async function requireTenantHook(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user.tenantId) {
    return reply.status(403).send({ error: "Cadastre uma empresa para continuar" });
  }
}

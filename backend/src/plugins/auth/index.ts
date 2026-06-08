import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { accessTokenTtl, requireJwtSecret } from "../../lib/auth/config.js";
import type { AccessTokenPayload } from "../../lib/auth/jwt-payload.js";
import type { AuthenticatedUser } from "../contexts/guards.js";

export const authPlugin = fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: requireJwtSecret(),
    sign: { expiresIn: accessTokenTtl() },
  });

  app.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify<AccessTokenPayload>();
      } catch {
        return reply.status(401).send({ error: "Não autorizado. Token ausente ou inválido." });
      }

      const payload = request.user;
      if (payload.typ !== "access") {
        return reply.status(401).send({ error: "Token inválido para esta operação." });
      }

      const row = await app.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { tokenVersion: true, tenantId: true, role: true, emailVerifiedAt: true },
      });

      if (!row || row.tokenVersion !== payload.tokenVersion) {
        return reply.status(401).send({ error: "Sessão encerrada. Entre novamente." });
      }

      request.user = {
        ...payload,
        tenantId: row.tenantId,
        role: row.role,
        emailVerified: row.emailVerifiedAt != null,
      } satisfies AuthenticatedUser;
    },
  );
});

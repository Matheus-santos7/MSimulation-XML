import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { authenticateRequest } from "../../lib/auth/access-control.js";
import { accessTokenTtl, requireJwtSecret } from "../../lib/auth/config.js";

export const authPlugin = fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: requireJwtSecret(),
    sign: { expiresIn: accessTokenTtl() },
  });

  app.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest, reply: FastifyReply) {
      const result = await authenticateRequest(app.prisma, request);
      if ("error" in result) {
        return reply.status(401).send({ error: result.error });
      }

      request.user = result.user;
    },
  );
});

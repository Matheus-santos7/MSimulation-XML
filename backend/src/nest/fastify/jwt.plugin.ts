import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { accessTokenTtl, requireJwtSecret } from "../../lib/auth/config.js";

/**
 * `@fastify/jwt` na instância raiz: `request.jwtVerify()` (usado pelo `JwtAuthGuard`)
 * e `app.jwt` (assinatura, injetada no Nest pelo token `JWT`).
 */
export const authPlugin = fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: requireJwtSecret(),
    sign: { expiresIn: accessTokenTtl() },
  });
});

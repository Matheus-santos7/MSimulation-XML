import "@fastify/jwt";
import type { AuthenticatedUser } from "../lib/auth/access-control.js";
import type { AccessTokenPayload } from "../lib/auth/types/index.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AuthenticatedUser;
  }
}

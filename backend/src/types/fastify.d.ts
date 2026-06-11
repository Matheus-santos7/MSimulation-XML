import "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AccessTokenPayload } from "../lib/auth/types/index.js";
import type { AuthenticatedUser } from "../plugins/contexts/guards.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AuthenticatedUser;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

import type { FastifyRequest } from "fastify";
import type { AccessTokenPayload } from "../../lib/auth/types/index.js";

export function authMeta(req: FastifyRequest) {
  return {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };
}

export function signAccess(app: {
  jwt: { sign: (p: AccessTokenPayload, o?: { expiresIn: string }) => string };
}) {
  return (payload: AccessTokenPayload) => app.jwt.sign(payload);
}

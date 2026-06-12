import type { FastifyRequest } from "fastify";
import type { AccessTokenPayload } from "../../domain/entities/auth-session.entity.js";

export function buildAuthMeta(request: FastifyRequest) {
  return {
    userAgent: request.headers["user-agent"],
    ipAddress: request.ip,
  };
}

export function signAccessToken(app: {
  jwt: { sign: (payload: AccessTokenPayload, options?: { expiresIn: string }) => string };
}) {
  return (payload: AccessTokenPayload) => app.jwt.sign(payload);
}

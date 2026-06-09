import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";

/** Rate limit nas rotas públicas de lookup (anti-abuso / proxy para APIs externas). */
export const lookupRateLimitPlugin: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    global: false,
    ban: 0,
  });
};

export const lookupRouteRateLimit = {
  max: 30,
  timeWindow: "1 minute" as const,
};

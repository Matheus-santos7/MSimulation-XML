import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/** Limite compartilhado por IP entre todas as rotas da API protegida. */
export const PROTECTED_API_RATE_LIMIT = {
  max: 300,
  timeWindow: "1 minute",
} as const;

/** `ban: 0` — a primeira requisição acima do limite já recebe 403 (auth e lookup). */
const STRICT_RATE_LIMIT_BAN = 0;

export type RouteRateLimit = {
  max: number;
  timeWindow: string;
  ban?: number;
};

export type RateLimitHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

/** Limite próprio de uma rota (conta por rota e por IP), com bloqueio 403 ao estourar. */
export function strictRouteRateLimit(max: number, timeWindow: string): RouteRateLimit {
  return { max, timeWindow, ban: STRICT_RATE_LIMIT_BAN };
}

/**
 * Registra `@fastify/rate-limit` uma única vez, na raiz, sem limite global.
 * Rotas Fastify declaram `config.rateLimit`; rotas Nest usam o `RateLimitInterceptor`.
 */
export async function registerRootRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, { global: false });
}

/** Cria um limitador avulso (store próprio) a partir do plugin registrado na raiz. */
export function createRateLimitHandler(app: FastifyInstance, options: RouteRateLimit): RateLimitHandler {
  return app.rateLimit(options) as RateLimitHandler;
}

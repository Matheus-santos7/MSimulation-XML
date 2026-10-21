import type { RateLimitHandler, RouteRateLimit } from "../lib/http/rate-limit.js";

/**
 * Tokens de injeção do Nest. O projeto não emite metadata de decorators (tsx/esbuild),
 * então toda dependência é declarada com `@Inject(TOKEN)` explícito.
 */
export const PRISMA = Symbol("PRISMA");
export const RATE_LIMITS = Symbol("RATE_LIMITS");
/** Logger do Fastify (pino), para logs de aplicação fora de uma requisição. */
export const LOGGER = Symbol("LOGGER");

export type RateLimits = {
  /** Limitador compartilhado da API protegida (mesmo store das rotas Fastify legadas). */
  protectedApi: RateLimitHandler;
  /** Cria um limitador com store próprio para uma rota. */
  create: (options: RouteRateLimit) => RateLimitHandler;
};

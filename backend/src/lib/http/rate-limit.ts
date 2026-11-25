import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Redis } from "ioredis";

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

/** Prefixo das chaves no Redis, para não colidir com outro uso do mesmo banco. */
const REDIS_NAMESPACE = "msx:rate-limit:";

/** Redis lento ou fora não pode segurar a requisição: falha rápido e a conta é pulada. */
const REDIS_CONNECT_TIMEOUT_MS = 500;

/**
 * Registra `@fastify/rate-limit` uma única vez, na raiz, sem limite global. Os limites
 * são aplicados pelo `RateLimitInterceptor` do Nest, depois dos guards.
 *
 * Com `redisUrl` (P-6) a contagem fica no Redis e vale para todas as instâncias da API; sem ele,
 * na memória do processo (dev, testes, instância única). Redis indisponível não derruba a API:
 * `skipOnError` deixa a requisição passar sem contar enquanto o ioredis reconecta.
 */
export async function registerRootRateLimit(
  app: FastifyInstance,
  redisUrl?: string,
): Promise<void> {
  if (!redisUrl) {
    await app.register(rateLimit, { global: false });

    return;
  }

  const redis = new Redis(redisUrl, {
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
  });
  redis.on("error", (err: Error) => app.log.warn({ err }, "Redis do rate limit indisponível"));
  app.addHook("onClose", async () => {
    await redis.quit();
  });
  await app.register(rateLimit, {
    global: false,
    redis,
    nameSpace: REDIS_NAMESPACE,
    skipOnError: true,
  });
}

/**
 * Cria um limitador avulso a partir do plugin registrado na raiz. `name` separa a contagem de cada
 * limitador: no Redis, todos os criados por `app.rateLimit()` usariam a mesma chave por IP.
 */
export function createRateLimitHandler(
  app: FastifyInstance,
  options: RouteRateLimit,
  name: string,
): RateLimitHandler {
  return app.rateLimit({
    ...options,
    keyGenerator: (request) => `${name}:${request.ip}`,
  }) as RateLimitHandler;
}

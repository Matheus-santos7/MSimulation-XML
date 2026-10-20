import { strictRouteRateLimit } from "../../../../lib/http/rate-limit.js";

/**
 * Rate limit pretendido para as rotas de lookup (anti-abuso / proxy para APIs externas).
 *
 * NÃO aplicado: o plugin antigo registrava `@fastify/rate-limit` num escopo filho sem rotas,
 * então o lookup nunca teve limite em produção. A migração preserva esse comportamento;
 * ligar o limite é decisão pendente (ver `tasks/plan-nestjs-migration.md`).
 */
export const lookupRouteRateLimit = strictRouteRateLimit(30, "1 minute");

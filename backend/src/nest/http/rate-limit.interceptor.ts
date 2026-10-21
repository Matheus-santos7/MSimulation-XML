import {
  Inject,
  Injectable,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import type { RateLimitHandler, RouteRateLimit } from "../../lib/http/rate-limit.js";
import { RATE_LIMITS, type RateLimits } from "../tokens.js";

const RATE_LIMIT_METADATA = "api:rate-limit";

/** `"protected-api"` usa o limite compartilhado; um objeto cria limite próprio da rota. */
export type RateLimitPolicy = "protected-api" | RouteRateLimit;

/** Declara o rate limit da rota ou do controller (a rota sobrescreve o controller). */
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_METADATA, policy);

/**
 * Aplica o rate limit depois dos guards, como os hooks Fastify legados:
 * requisição recusada por JWT, tenant ou papel não entra na contagem.
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly routeHandlers = new WeakMap<object, RateLimitHandler>();

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RATE_LIMITS) private readonly rateLimits: RateLimits,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const handler = this.resolveHandler(context);
    if (handler) {
      const http = context.switchToHttp();
      await handler(http.getRequest<FastifyRequest>(), http.getResponse<FastifyReply>());
    }

    return next.handle();
  }

  private resolveHandler(context: ExecutionContext): RateLimitHandler | null {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(
      RATE_LIMIT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) return null;
    if (policy === "protected-api") return this.rateLimits.protectedApi;

    const route = context.getHandler();
    const existing = this.routeHandlers.get(route);
    if (existing) return existing;

    const created = this.rateLimits.create(policy);
    this.routeHandlers.set(route, created);

    return created;
  }
}

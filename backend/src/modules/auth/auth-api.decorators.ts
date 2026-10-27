import {
  applyDecorators,
  createParamDecorator,
  UseFilters,
  UseInterceptors,
  type ExecutionContext,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { DbContextInterceptor } from "../../nest/db/db-context.interceptor.js";
import { RateLimitInterceptor } from "../../nest/http/rate-limit.interceptor.js";
import { AuthErrorFilter } from "./errors/auth-error.filter.js";
import type { AuthMeta } from "./session/session.types.js";

/**
 * Comum a todos os controllers de auth: rate limit próprio de cada rota (`@RateLimit`),
 * transação com RLS (`userId` quando há sessão) e o filtro de erros do auth.
 */
export function AuthApi(): ClassDecorator {
  return applyDecorators(
    UseInterceptors(RateLimitInterceptor, DbContextInterceptor),
    UseFilters(new AuthErrorFilter()),
  );
}

/** User-Agent e IP da requisição, gravados na sessão criada. */
export const RequestMeta = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthMeta => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    return { userAgent: request.headers["user-agent"], ipAddress: request.ip };
  },
);

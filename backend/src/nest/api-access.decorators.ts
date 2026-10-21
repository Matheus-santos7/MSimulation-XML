import { applyDecorators, UseGuards, UseInterceptors } from "@nestjs/common";
import { AdminGuard, EmailVerifiedGuard, JwtAuthGuard, TenantGuard } from "./auth/guards.js";
import { DbContextInterceptor } from "./db/db-context.interceptor.js";
import { RateLimit, RateLimitInterceptor } from "./http/rate-limit.interceptor.js";

/**
 * Controller de negócio: JWT, empresa e e-mail confirmados; limite compartilhado de
 * 300/min (contado depois dos guards); handler dentro da transação com RLS.
 */
export function ProtectedApi() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, TenantGuard, EmailVerifiedGuard),
    RateLimit("protected-api"),
    UseInterceptors(RateLimitInterceptor, DbContextInterceptor),
  );
}

/** Só JWT, sem tenant nem transação (lookup de CNPJ/CEP no onboarding). */
export function AuthenticatedApi() {
  return UseGuards(JwtAuthGuard);
}

/** Rota restrita a ADMIN. Os guards de método rodam depois dos do controller. */
export function AdminOnly() {
  return UseGuards(AdminGuard);
}

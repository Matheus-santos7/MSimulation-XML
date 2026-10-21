import { Body, Controller, HttpCode, Inject, Post, Req, UseFilters, UseGuards, UseInterceptors } from "@nestjs/common";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthenticatedUser } from "../../../../lib/auth/access-control.js";
import { HttpError } from "../../../../lib/http/http-error.js";
import { JwtAuthGuard } from "../../../../nest/auth/guards.js";
import { CurrentUser } from "../../../../nest/auth/request-params.js";
import { DbContextInterceptor } from "../../../../nest/db/db-context.interceptor.js";
import { JWT } from "../../../../nest/tokens.js";
import { tenantCreateBody } from "../../../org/index.js";
import { AUTH, type AuthContext } from "../../auth.tokens.js";
import { AuthErrorFilter } from "../filters/auth-error.filter.js";
import { buildAuthMeta, signAccessToken } from "../helpers/auth-request.helper.js";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;

/**
 * Onboarding pós-registo: cria o tenant e associa ao utilizador autenticado.
 *
 * Requer JWT válido e `tenantId === null`. Após sucesso, devolve nova sessão
 * com `tenantId` preenchido e role `ADMIN`.
 *
 * @route POST `/auth/onboarding/tenant` → AttachTenantOnboardingUseCase
 */
@Controller("auth/onboarding")
@UseGuards(JwtAuthGuard)
@UseInterceptors(DbContextInterceptor)
@UseFilters(new AuthErrorFilter())
export class OnboardingController {
  constructor(
    @Inject(AUTH) private readonly auth: AuthContext,
    @Inject(JWT) private readonly jwt: FastifyInstance["jwt"],
  ) {}

  @Post("tenant")
  @HttpCode(HTTP_OK)
  attachTenant(@CurrentUser() user: AuthenticatedUser, @Body() rawBody: unknown, @Req() request: FastifyRequest) {
    if (user.tenantId) {
      throw new HttpError(HTTP_BAD_REQUEST, "Empresa já cadastrada nesta conta");
    }

    // Corpo validado depois da checagem de empresa, como no controller Fastify.
    const tenantData = tenantCreateBody.parse(rawBody);

    return this.auth.attachTenantOnboarding.execute(
      { userId: user.userId, tenantData },
      signAccessToken({ jwt: this.jwt }),
      buildAuthMeta(request),
    );
  }
}

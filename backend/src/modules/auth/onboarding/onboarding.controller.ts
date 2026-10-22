import { Body, Controller, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../../lib/auth/access-control.js";
import { JwtAuthGuard } from "../../../nest/auth/guards.js";
import { CurrentUser } from "../../../nest/auth/request-params.js";
import { tenantCreateBody } from "../../org/index.js";
import { AuthApi, RequestMeta } from "../auth-api.decorators.js";
import { AuthError } from "../errors/auth.errors.js";
import type { AuthMeta } from "../session/session.types.js";
import { AttachTenantOnboardingUseCase } from "./use-cases/attach-tenant-onboarding.usecase.js";

const HTTP_OK = 200;

/**
 * Onboarding depois do cadastro: cria a empresa e vincula ao usuário autenticado.
 * Exige JWT e conta sem empresa; devolve sessão nova, com `tenantId` e papel ADMIN.
 *
 * `POST /auth/onboarding/tenant` → AttachTenantOnboardingUseCase
 */
@Controller("auth/onboarding")
@ApiTags("auth")
@UseGuards(JwtAuthGuard)
@AuthApi()
export class OnboardingController {
  constructor(
    @Inject(AttachTenantOnboardingUseCase)
    private readonly attachTenantOnboarding: AttachTenantOnboardingUseCase,
  ) {}

  @Post("tenant")
  @HttpCode(HTTP_OK)
  attachTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() rawBody: unknown,
    @RequestMeta() meta: AuthMeta,
  ) {
    if (user.tenantId) {
      throw new AuthError.State("Empresa já cadastrada nesta conta");
    }

    // Corpo validado depois da checagem de empresa (schema de tenant do org).
    const tenantData = tenantCreateBody.parse(rawBody);

    return this.attachTenantOnboarding.execute({ userId: user.userId, tenantData }, meta);
  }
}

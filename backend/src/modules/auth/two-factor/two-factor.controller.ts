import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { verifyTurnstileToken } from "../../../lib/auth/turnstile.js";
import { strictRouteRateLimit } from "../../../lib/http/rate-limit.js";
import { JwtAuthGuard } from "../../../nest/auth/guards.js";
import { UserId } from "../../../nest/auth/request-params.js";
import { ApiExceptionFilter } from "../../../nest/http/api-exception.filter.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RateLimit } from "../../../nest/http/rate-limit.interceptor.js";
import { AuthApi, RequestMeta } from "../auth-api.decorators.js";
import type { AuthMeta } from "../session/session.types.js";
import {
  disableTwoFactorRequestSchema,
  type DisableTwoFactorRequestDTO,
} from "./dtos/disable-two-factor.request.dto.js";
import {
  enableTwoFactorRequestSchema,
  type EnableTwoFactorRequestDTO,
} from "./dtos/enable-two-factor.request.dto.js";
import {
  verifyTwoFactorRequestSchema,
  type VerifyTwoFactorRequestDTO,
} from "./dtos/verify-two-factor.request.dto.js";
import { DisableTwoFactorUseCase } from "./use-cases/disable-two-factor.usecase.js";
import { EnableTwoFactorUseCase } from "./use-cases/enable-two-factor.usecase.js";
import { GetTwoFactorStatusUseCase } from "./use-cases/get-two-factor-status.usecase.js";
import { SetupTwoFactorUseCase } from "./use-cases/setup-two-factor.usecase.js";
import { VerifyTwoFactorLoginUseCase } from "./use-cases/verify-two-factor-login.usecase.js";

const HTTP_OK = 200;

const TWO_FACTOR_RATE_LIMIT = strictRouteRateLimit(5, "15 minutes");

/**
 * Autenticação em duas etapas (TOTP).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | POST | `/auth/login/verify-2fa` | VerifyTwoFactorLoginUseCase |
 * | GET | `/auth/2fa/status` | GetTwoFactorStatusUseCase |
 * | POST | `/auth/2fa/setup` | SetupTwoFactorUseCase |
 * | POST | `/auth/2fa/enable` | EnableTwoFactorUseCase |
 * | POST | `/auth/2fa/disable` | DisableTwoFactorUseCase |
 */
@Controller("auth")
@ApiTags("auth")
@AuthApi()
export class TwoFactorController {
  constructor(
    @Inject(VerifyTwoFactorLoginUseCase)
    private readonly verifyTwoFactorLogin: VerifyTwoFactorLoginUseCase,
    @Inject(GetTwoFactorStatusUseCase)
    private readonly getTwoFactorStatus: GetTwoFactorStatusUseCase,
    @Inject(SetupTwoFactorUseCase) private readonly setupTwoFactor: SetupTwoFactorUseCase,
    @Inject(EnableTwoFactorUseCase) private readonly enableTwoFactor: EnableTwoFactorUseCase,
    @Inject(DisableTwoFactorUseCase) private readonly disableTwoFactor: DisableTwoFactorUseCase,
  ) {}

  @Post("login/verify-2fa")
  @RateLimit(strictRouteRateLimit(10, "15 minutes"))
  @HttpCode(HTTP_OK)
  async verifyLogin(
    @Body(new ZodValidationPipe(verifyTwoFactorRequestSchema)) body: VerifyTwoFactorRequestDTO,
    @RequestMeta() meta: AuthMeta,
  ) {
    await verifyTurnstileToken(body.captchaToken);

    return this.verifyTwoFactorLogin.execute(body, meta);
  }

  /** Erros seguem o contrato global (sem o filtro de auth). */
  @Get("2fa/status")
  @UseGuards(JwtAuthGuard)
  @UseFilters(new ApiExceptionFilter())
  status(@UserId() userId: string) {
    return this.getTwoFactorStatus.execute(userId);
  }

  @Post("2fa/setup")
  @UseGuards(JwtAuthGuard)
  @RateLimit(TWO_FACTOR_RATE_LIMIT)
  @HttpCode(HTTP_OK)
  setup(@UserId() userId: string) {
    return this.setupTwoFactor.execute(userId);
  }

  @Post("2fa/enable")
  @UseGuards(JwtAuthGuard)
  @RateLimit(TWO_FACTOR_RATE_LIMIT)
  @HttpCode(HTTP_OK)
  enable(
    @UserId() userId: string,
    @Body(new ZodValidationPipe(enableTwoFactorRequestSchema)) body: EnableTwoFactorRequestDTO,
  ) {
    return this.enableTwoFactor.execute(userId, body.code);
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard)
  @RateLimit(TWO_FACTOR_RATE_LIMIT)
  @HttpCode(HTTP_OK)
  disable(
    @UserId() userId: string,
    @Body(new ZodValidationPipe(disableTwoFactorRequestSchema)) body: DisableTwoFactorRequestDTO,
  ) {
    return this.disableTwoFactor.execute(userId, body.password, body.code);
  }
}

import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { verifyTurnstileToken } from "../../../lib/auth/turnstile.js";
import { strictRouteRateLimit } from "../../../lib/http/rate-limit.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RateLimit } from "../../../nest/http/rate-limit.interceptor.js";
import { AuthApi } from "../auth-api.decorators.js";
import {
  forgotPasswordRequestSchema,
  type ForgotPasswordRequestDTO,
} from "./dtos/forgot-password.request.dto.js";
import {
  resetPasswordRequestSchema,
  type ResetPasswordRequestDTO,
} from "./dtos/reset-password.request.dto.js";
import { RequestPasswordResetUseCase } from "./use-cases/request-password-reset.usecase.js";
import { ResetPasswordUseCase } from "./use-cases/reset-password.usecase.js";

const HTTP_OK = 200;

/**
 * Redefinição de senha por e-mail.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | POST | `/auth/forgot-password` | RequestPasswordResetUseCase |
 * | POST | `/auth/reset-password` | ResetPasswordUseCase |
 */
@Controller("auth")
@ApiTags("auth")
@AuthApi()
export class PasswordResetController {
  constructor(
    @Inject(RequestPasswordResetUseCase)
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    @Inject(ResetPasswordUseCase) private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @Post("forgot-password")
  @RateLimit(strictRouteRateLimit(5, "1 hour"))
  @HttpCode(HTTP_OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema)) body: ForgotPasswordRequestDTO,
  ) {
    await verifyTurnstileToken(body.captchaToken);

    return this.requestPasswordReset.execute(body);
  }

  @Post("reset-password")
  @RateLimit(strictRouteRateLimit(10, "15 minutes"))
  @HttpCode(HTTP_OK)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema)) body: ResetPasswordRequestDTO,
  ) {
    return this.resetPasswordUseCase.execute(body);
  }
}

import { Body, Controller, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { strictRouteRateLimit } from "../../../lib/http/rate-limit.js";
import { JwtAuthGuard } from "../../../nest/auth/guards.js";
import { UserId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RateLimit } from "../../../nest/http/rate-limit.interceptor.js";
import { AuthApi } from "../auth-api.decorators.js";
import {
  verifyEmailRequestSchema,
  type VerifyEmailRequestDTO,
} from "./dtos/verify-email.request.dto.js";
import { ResendVerificationEmailUseCase } from "./use-cases/resend-verification-email.usecase.js";
import { VerifyEmailUseCase } from "./use-cases/verify-email.usecase.js";

const HTTP_OK = 200;

/**
 * Confirmação de e-mail.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | POST | `/auth/verify-email` | VerifyEmailUseCase |
 * | POST | `/auth/resend-verification` | ResendVerificationEmailUseCase |
 */
@Controller("auth")
@ApiTags("auth")
@AuthApi()
export class EmailVerificationController {
  constructor(
    @Inject(VerifyEmailUseCase) private readonly verifyEmailUseCase: VerifyEmailUseCase,
    @Inject(ResendVerificationEmailUseCase)
    private readonly resendVerificationEmail: ResendVerificationEmailUseCase,
  ) {}

  @Post("verify-email")
  @RateLimit(strictRouteRateLimit(10, "15 minutes"))
  @HttpCode(HTTP_OK)
  verifyEmail(@Body(new ZodValidationPipe(verifyEmailRequestSchema)) body: VerifyEmailRequestDTO) {
    return this.verifyEmailUseCase.execute(body.token);
  }

  @Post("resend-verification")
  @UseGuards(JwtAuthGuard)
  @RateLimit(strictRouteRateLimit(5, "1 hour"))
  @HttpCode(HTTP_OK)
  resendVerification(@UserId() userId: string) {
    return this.resendVerificationEmail.execute(userId);
  }
}

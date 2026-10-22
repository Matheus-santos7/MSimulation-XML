import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { verifyTurnstileToken } from "../../../lib/auth/turnstile.js";
import { strictRouteRateLimit } from "../../../lib/http/rate-limit.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RateLimit } from "../../../nest/http/rate-limit.interceptor.js";
import { AuthApi, RequestMeta } from "../auth-api.decorators.js";
import type { AuthMeta } from "../session/session.types.js";
import { registerRequestSchema, type RegisterRequestDTO } from "./dtos/register.request.dto.js";
import { RegisterUserUseCase } from "./use-cases/register-user.usecase.js";

const HTTP_CREATED = 201;

/** Cadastro de conta: `POST /auth/register` → RegisterUserUseCase. */
@Controller("auth")
@ApiTags("auth")
@AuthApi()
export class RegistrationController {
  constructor(@Inject(RegisterUserUseCase) private readonly registerUser: RegisterUserUseCase) {}

  @Post("register")
  @RateLimit(strictRouteRateLimit(5, "1 hour"))
  @HttpCode(HTTP_CREATED)
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequestDTO,
    @RequestMeta() meta: AuthMeta,
  ) {
    await verifyTurnstileToken(body.captchaToken);

    return this.registerUser.execute(body, meta);
  }
}

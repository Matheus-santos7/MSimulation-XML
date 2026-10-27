import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { verifyTurnstileToken } from "../../../lib/auth/turnstile.js";
import { strictRouteRateLimit } from "../../../lib/http/rate-limit.js";
import { JwtAuthGuard } from "../../../nest/auth/guards.js";
import { UserId } from "../../../nest/auth/request-params.js";
import { ApiExceptionFilter } from "../../../nest/http/api-exception.filter.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RateLimit } from "../../../nest/http/rate-limit.interceptor.js";
import { AuthApi, RequestMeta } from "../auth-api.decorators.js";
import { loginRequestSchema, type LoginRequestDTO } from "./dtos/login.request.dto.js";
import { logoutRequestSchema } from "./dtos/logout.request.dto.js";
import { refreshRequestSchema, type RefreshRequestDTO } from "./dtos/refresh.request.dto.js";
import type { AccessTokenPayload, AuthMeta } from "./session.types.js";
import { GetCurrentUserUseCase } from "./use-cases/get-current-user.usecase.js";
import { LoginUseCase } from "./use-cases/login.usecase.js";
import { LogoutUseCase } from "./use-cases/logout.usecase.js";
import { RefreshSessionUseCase } from "./use-cases/refresh-session.usecase.js";

const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;

/**
 * Sessão: login, renovação, logout e perfil.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | POST | `/auth/login` | LoginUseCase |
 * | POST | `/auth/refresh` | RefreshSessionUseCase |
 * | POST | `/auth/logout` | LogoutUseCase |
 * | GET | `/auth/me` | GetCurrentUserUseCase |
 */
@Controller("auth")
@ApiTags("auth")
@AuthApi()
export class SessionController {
  constructor(
    @Inject(LoginUseCase) private readonly login: LoginUseCase,
    @Inject(RefreshSessionUseCase) private readonly refreshSession: RefreshSessionUseCase,
    @Inject(LogoutUseCase) private readonly logoutUseCase: LogoutUseCase,
    @Inject(GetCurrentUserUseCase) private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Post("login")
  @RateLimit(strictRouteRateLimit(10, "15 minutes"))
  @HttpCode(HTTP_OK)
  async signIn(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequestDTO,
    @RequestMeta() meta: AuthMeta,
  ) {
    await verifyTurnstileToken(body.captchaToken);

    return this.login.execute(body, meta);
  }

  @Post("refresh")
  @RateLimit(strictRouteRateLimit(30, "15 minutes"))
  @HttpCode(HTTP_OK)
  refresh(
    @Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequestDTO,
    @RequestMeta() meta: AuthMeta,
  ) {
    return this.refreshSession.execute(body.refreshToken, meta);
  }

  /** Aceita refresh token, access token, os dois ou nenhum (sempre 204). */
  @Post("logout")
  @RateLimit(strictRouteRateLimit(20, "15 minutes"))
  @HttpCode(HTTP_NO_CONTENT)
  async logout(@Body() rawBody: unknown, @Req() request: FastifyRequest): Promise<void> {
    await this.logoutUseCase.execute(
      optionalRefreshToken(rawBody),
      await optionalAccessUserId(request),
    );
  }

  /** Erros seguem o contrato global (sem o filtro de auth). */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @UseFilters(new ApiExceptionFilter())
  me(@UserId() userId: string) {
    return this.getCurrentUser.execute(userId);
  }
}

/** Refresh token do corpo, quando válido; corpo ausente ou inválido não impede o logout. */
function optionalRefreshToken(rawBody: unknown): string | undefined {
  const body = logoutRequestSchema.safeParse(rawBody ?? {});

  return body.success ? body.data.refreshToken : undefined;
}

/** `userId` do access token, quando presente e válido; token inválido não impede o logout. */
async function optionalAccessUserId(request: FastifyRequest): Promise<string | undefined> {
  try {
    await request.jwtVerify<AccessTokenPayload>();
  } catch {
    return undefined;
  }

  return request.user.typ === "access" ? request.user.userId : undefined;
}

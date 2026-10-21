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
  UseInterceptors,
} from "@nestjs/common";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { z } from "zod";
import { isEmailVerified, twoFactorPendingTtl } from "../../../../lib/auth/config.js";
import { verifyTurnstileToken } from "../../../../lib/auth/turnstile.js";
import type { TwoFactorPendingPayload } from "../../../../lib/auth/types/index.js";
import { strictRouteRateLimit } from "../../../../lib/http/rate-limit.js";
import { JwtAuthGuard } from "../../../../nest/auth/guards.js";
import { UserId } from "../../../../nest/auth/request-params.js";
import { DbContextInterceptor } from "../../../../nest/db/db-context.interceptor.js";
import { ApiExceptionFilter } from "../../../../nest/http/api-exception.filter.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { RateLimit, RateLimitInterceptor } from "../../../../nest/http/rate-limit.interceptor.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { JWT } from "../../../../nest/tokens.js";
import { AUTH, type AuthContext } from "../../auth.tokens.js";
import type { AccessTokenPayload } from "../../domain/entities/auth-session.entity.js";
import { AuthErrorFilter } from "../filters/auth-error.filter.js";
import { buildAuthMeta, signAccessToken } from "../helpers/auth-request.helper.js";
import {
  disable2faBodySchema,
  enable2faBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verify2faBodySchema,
  verifyEmailBodySchema,
} from "../schemas/auth.schemas.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

const TWO_FACTOR_RATE_LIMIT = strictRouteRateLimit(5, "15 minutes");

type Jwt = FastifyInstance["jwt"];

/**
 * Controller HTTP de autenticação e gestão de sessão.
 *
 * Valida entrada com Zod, aplica rate limit por rota (bloqueio 403 ao estourar) e
 * Turnstile no registo, login, forgot-password e verify-2fa. Todas as rotas rodam na
 * transação com RLS (`userId` quando há sessão). Onboarding em `OnboardingController`.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | POST | `/auth/register` | RegisterUserUseCase |
 * | POST | `/auth/login` | LoginUseCase |
 * | POST | `/auth/login/verify-2fa` | VerifyTwoFactorLoginUseCase |
 * | POST | `/auth/refresh` | RefreshSessionUseCase |
 * | POST | `/auth/logout` | LogoutUseCase |
 * | GET | `/auth/me` | GetCurrentUserUseCase |
 * | POST | `/auth/forgot-password` | RequestPasswordResetUseCase |
 * | POST | `/auth/reset-password` | ResetPasswordUseCase |
 * | POST | `/auth/verify-email` | VerifyEmailUseCase |
 * | POST | `/auth/resend-verification` | ResendVerificationEmailUseCase |
 * | GET | `/auth/2fa/status` | GetTwoFactorStatusUseCase |
 * | POST | `/auth/2fa/setup` | SetupTwoFactorUseCase |
 * | POST | `/auth/2fa/enable` | EnableTwoFactorUseCase |
 * | POST | `/auth/2fa/disable` | DisableTwoFactorUseCase |
 */
@Controller("auth")
@UseInterceptors(RateLimitInterceptor, DbContextInterceptor)
@UseFilters(new AuthErrorFilter())
export class AuthController {
  private readonly signAccess: (payload: AccessTokenPayload) => string;
  private readonly signTwoFactorPending: (payload: TwoFactorPendingPayload) => string;

  constructor(
    @Inject(AUTH) private readonly auth: AuthContext,
    @Inject(JWT) private readonly jwt: Jwt,
  ) {
    this.signAccess = signAccessToken({ jwt });
    // JWT temporário `2fa_pending`, com TTL próprio. O `sign` do @fastify/jwt é tipado
    // para o payload de acesso (`FastifyJWT.payload`), daí o cast.
    const signPending = jwt.sign as unknown as (
      payload: TwoFactorPendingPayload,
      options: { expiresIn: string },
    ) => string;
    this.signTwoFactorPending = (payload) =>
      signPending(payload, { expiresIn: twoFactorPendingTtl() });
  }

  @Post("register")
  @RateLimit(strictRouteRateLimit(5, "1 hour"))
  @HttpCode(HTTP_CREATED)
  async register(
    @Body(new ZodValidationPipe(registerBodySchema)) body: z.infer<typeof registerBodySchema>,
    @Req() request: FastifyRequest,
  ) {
    await verifyTurnstileToken(body.captchaToken);

    return this.auth.registerUser.execute(body, this.signAccess, buildAuthMeta(request));
  }

  @Post("login")
  @RateLimit(strictRouteRateLimit(10, "15 minutes"))
  @HttpCode(HTTP_OK)
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: z.infer<typeof loginBodySchema>,
    @Req() request: FastifyRequest,
  ) {
    await verifyTurnstileToken(body.captchaToken);

    return this.auth.login.execute(
      { email: body.email, password: body.password },
      this.signAccess,
      buildAuthMeta(request),
      this.signTwoFactorPending,
    );
  }

  @Post("forgot-password")
  @RateLimit(strictRouteRateLimit(5, "1 hour"))
  @HttpCode(HTTP_OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordBodySchema))
    body: z.infer<typeof forgotPasswordBodySchema>,
  ) {
    await verifyTurnstileToken(body.captchaToken);

    return this.auth.requestPasswordReset.execute({ email: body.email });
  }

  @Post("reset-password")
  @RateLimit(strictRouteRateLimit(10, "15 minutes"))
  @HttpCode(HTTP_OK)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordBodySchema))
    body: z.infer<typeof resetPasswordBodySchema>,
  ) {
    return this.auth.resetPassword.execute(body);
  }

  @Post("login/verify-2fa")
  @RateLimit(strictRouteRateLimit(10, "15 minutes"))
  @HttpCode(HTTP_OK)
  async verifyTwoFactorLogin(
    @Body(new ZodValidationPipe(verify2faBodySchema)) body: z.infer<typeof verify2faBodySchema>,
    @Req() request: FastifyRequest,
  ) {
    await verifyTurnstileToken(body.captchaToken);

    return this.auth.verifyTwoFactorLogin.execute(
      { twoFactorToken: body.twoFactorToken, code: body.code },
      buildAuthMeta(request),
      this.signAccess,
      (token) => this.jwt.verify<TwoFactorPendingPayload>(token),
    );
  }

  /** Sem `try/catch` no controller original: erros seguem o contrato global. */
  @Get("2fa/status")
  @UseGuards(JwtAuthGuard)
  @UseFilters(new ApiExceptionFilter())
  twoFactorStatus(@UserId() userId: string) {
    return this.auth.getTwoFactorStatus.execute(userId);
  }

  @Post("2fa/setup")
  @UseGuards(JwtAuthGuard)
  @RateLimit(TWO_FACTOR_RATE_LIMIT)
  @HttpCode(HTTP_OK)
  setupTwoFactor(@UserId() userId: string) {
    return this.auth.setupTwoFactor.execute(userId);
  }

  @Post("2fa/enable")
  @UseGuards(JwtAuthGuard)
  @RateLimit(TWO_FACTOR_RATE_LIMIT)
  @HttpCode(HTTP_OK)
  enableTwoFactor(
    @UserId() userId: string,
    @Body(new ZodValidationPipe(enable2faBodySchema)) body: z.infer<typeof enable2faBodySchema>,
  ) {
    return this.auth.enableTwoFactor.execute(userId, body.code);
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard)
  @RateLimit(TWO_FACTOR_RATE_LIMIT)
  @HttpCode(HTTP_OK)
  disableTwoFactor(
    @UserId() userId: string,
    @Body(new ZodValidationPipe(disable2faBodySchema)) body: z.infer<typeof disable2faBodySchema>,
  ) {
    return this.auth.disableTwoFactor.execute(userId, body.password, body.code);
  }

  @Post("refresh")
  @RateLimit(strictRouteRateLimit(30, "15 minutes"))
  @HttpCode(HTTP_OK)
  refresh(
    @Body(new ZodValidationPipe(refreshBodySchema)) body: z.infer<typeof refreshBodySchema>,
    @Req() request: FastifyRequest,
  ) {
    return this.auth.refreshSession.execute(
      body.refreshToken,
      this.signAccess,
      buildAuthMeta(request),
    );
  }

  /** Logout aceita refresh token, access token, os dois ou nenhum (sempre 204). */
  @Post("logout")
  @RateLimit(strictRouteRateLimit(20, "15 minutes"))
  @HttpCode(HTTP_NO_CONTENT)
  async logout(@Body() rawBody: unknown, @Req() request: FastifyRequest): Promise<void> {
    const body = logoutBodySchema.safeParse(rawBody ?? {});
    const refreshToken = body.success ? body.data.refreshToken : undefined;

    await this.auth.logout.execute(refreshToken, await this.optionalAccessUserId(request));
  }

  /** Sem `try/catch` no controller original: erros seguem o contrato global. */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @UseFilters(new ApiExceptionFilter())
  async me(@UserId() userId: string) {
    const result = orNotFound(
      await this.auth.getCurrentUser.execute(userId),
      "Usuário não encontrado",
    );

    return {
      userId: result.user.id,
      tenantId: result.user.tenantId,
      email: result.user.email,
      name: result.user.name ?? undefined,
      tenant: result.tenant,
      needsOnboarding: result.user.tenantId === null,
      twoFactorEnabled: result.user.totpEnabledAt != null,
      emailVerified: isEmailVerified(result.user.emailVerifiedAt),
      role: result.user.role,
    };
  }

  @Post("verify-email")
  @RateLimit(strictRouteRateLimit(10, "15 minutes"))
  @HttpCode(HTTP_OK)
  verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailBodySchema)) body: z.infer<typeof verifyEmailBodySchema>,
  ) {
    return this.auth.verifyEmail.execute(body.token);
  }

  @Post("resend-verification")
  @UseGuards(JwtAuthGuard)
  @RateLimit(strictRouteRateLimit(5, "1 hour"))
  @HttpCode(HTTP_OK)
  resendVerification(@UserId() userId: string) {
    return this.auth.resendVerificationEmail.execute(userId);
  }

  /** `userId` do access token, quando presente e válido; token inválido não impede o logout. */
  private async optionalAccessUserId(request: FastifyRequest): Promise<string | undefined> {
    try {
      await request.jwtVerify<AccessTokenPayload>();
    } catch {
      return undefined;
    }

    return request.user.typ === "access" ? request.user.userId : undefined;
  }
}

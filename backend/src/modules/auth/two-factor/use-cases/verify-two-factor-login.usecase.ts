import { Inject, Injectable } from "@nestjs/common";
import { AuthTokenService } from "../../auth-token.service.js";
import { AuthError } from "../../errors/auth.errors.js";
import { LoginLockoutProvider } from "../../providers/login-lockout.provider.js";
import { TotpProvider } from "../../providers/totp.provider.js";
import type {
  AuthMeta,
  AuthSessionResponse,
  TwoFactorPendingPayload,
} from "../../session/session.types.js";
import { FinishLoginUseCase } from "../../session/use-cases/finish-login.usecase.js";
import { UserRepository } from "../../user/user.repository.js";
import type { VerifyTwoFactorRequestDTO } from "../dtos/verify-two-factor.request.dto.js";

const EXPIRED_CHALLENGE_MESSAGE = "Sessão de verificação expirada. Entre novamente.";

/**
 * Completa o login com 2FA: valida o JWT `2fa_pending` e o código TOTP.
 *
 * @throws {AuthError.TwoFactorRequired} Token expirado, código inválido ou 2FA inativo
 * @throws {AuthError.TooManyRequests} Conta bloqueada
 */
@Injectable()
export class VerifyTwoFactorLoginUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(LoginLockoutProvider) private readonly loginLockout: LoginLockoutProvider,
    @Inject(TotpProvider) private readonly totp: TotpProvider,
    @Inject(AuthTokenService) private readonly authTokens: AuthTokenService,
    @Inject(FinishLoginUseCase) private readonly finishLogin: FinishLoginUseCase,
  ) {}

  async execute(
    command: Pick<VerifyTwoFactorRequestDTO, "twoFactorToken" | "code">,
    meta: AuthMeta,
  ): Promise<AuthSessionResponse> {
    let payload: TwoFactorPendingPayload;
    try {
      payload = this.authTokens.verifyTwoFactorPending(command.twoFactorToken);
    } catch {
      throw new AuthError.TwoFactorRequired(EXPIRED_CHALLENGE_MESSAGE);
    }

    if (payload.typ !== "2fa_pending") {
      throw new AuthError.TwoFactorRequired();
    }

    const user = await this.userRepository.findAuthUserById(payload.userId);
    if (!user || user.tokenVersion !== payload.tokenVersion || !user.totpEnabledAt) {
      throw new AuthError.TwoFactorRequired(EXPIRED_CHALLENGE_MESSAGE);
    }

    if (this.loginLockout.isLoginLocked(user.lockedUntil)) {
      throw new AuthError.TooManyRequests(this.loginLockout.lockoutMessage(user.lockedUntil!));
    }

    const secret = user.totpSecretEnc ? this.totp.decryptSecret(user.totpSecretEnc) : null;
    if (!secret || !(await this.totp.verifyCode(secret, command.code))) {
      await this.userRepository.updateLoginLockout(
        user.id,
        this.loginLockout.nextFailedLoginState(user.failedLoginAttempts),
      );
      throw new AuthError.TwoFactorRequired();
    }

    await this.userRepository.clearLoginLockout(user.id);

    return this.finishLogin.execute(user.id, meta);
  }
}

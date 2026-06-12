import type { AuthSessionResponse } from "../../domain/entities/auth-session.entity.js";
import type { TwoFactorPendingPayload } from "../../domain/entities/auth-session.entity.js";
import { AuthTooManyRequestsError } from "../../domain/errors/auth-too-many-requests.error.js";
import { TwoFactorRequiredError } from "../../domain/errors/two-factor-required.error.js";
import type { LoginLockoutPort } from "../../domain/ports/login-lockout.port.js";
import type {
  AuthMeta,
  SignAccessToken,
} from "../../domain/ports/session-response.port.js";
import type { TotpPort } from "../../domain/ports/totp.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import type { VerifyTwoFactorLoginCommand } from "../dto/verify-two-factor-login.command.js";
import { FinishLoginUseCase } from "./finish-login.use-case.js";

/**
 * Completa login após desafio 2FA: valida JWT `2fa_pending` e código TOTP.
 *
 * @param command - Token temporário e código de 6 dígitos
 * @param verifyJwt - Verifica assinatura e expiração do JWT pendente
 * @returns Sessão completa via {@link FinishLoginUseCase}
 * @throws {TwoFactorRequiredError} Token expirado, código inválido ou 2FA inativo
 * @throws {AuthTooManyRequestsError} Conta bloqueada
 */
export class VerifyTwoFactorLoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly loginLockout: LoginLockoutPort,
    private readonly totp: TotpPort,
    private readonly finishLogin: FinishLoginUseCase,
  ) {}

  async execute(
    command: VerifyTwoFactorLoginCommand,
    meta: AuthMeta,
    signAccess: SignAccessToken,
    verifyJwt: (token: string) => TwoFactorPendingPayload,
  ): Promise<AuthSessionResponse> {
    let payload: TwoFactorPendingPayload;
    try {
      payload = verifyJwt(command.twoFactorToken);
    } catch {
      throw new TwoFactorRequiredError("Sessão de verificação expirada. Entre novamente.");
    }

    if (payload.typ !== "2fa_pending") {
      throw new TwoFactorRequiredError();
    }

    const user = await this.userRepository.findAuthUserById(payload.userId);

    if (!user || user.tokenVersion !== payload.tokenVersion || !user.totpEnabledAt) {
      throw new TwoFactorRequiredError("Sessão de verificação expirada. Entre novamente.");
    }

    if (this.loginLockout.isLoginLocked(user.lockedUntil)) {
      throw new AuthTooManyRequestsError(this.loginLockout.lockoutMessage(user.lockedUntil!));
    }

    const secret = user.totpSecretEnc ? this.totp.decryptSecret(user.totpSecretEnc) : null;
    if (!secret || !(await this.totp.verifyCode(secret, command.code))) {
      await this.userRepository.updateLoginLockout(
        user.id,
        this.loginLockout.nextFailedLoginState(user.failedLoginAttempts),
      );
      throw new TwoFactorRequiredError();
    }

    await this.userRepository.clearLoginLockout(user.id);

    return this.finishLogin.execute(user.id, meta, signAccess);
  }
}

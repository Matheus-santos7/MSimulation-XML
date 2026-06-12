import { AuthTooManyRequestsError } from "../../domain/errors/auth-too-many-requests.error.js";
import { PasswordResetInvalidError } from "../../domain/errors/password-reset-invalid.error.js";
import { TwoFactorRequiredError } from "../../domain/errors/two-factor-required.error.js";
import type { LoginLockoutPort } from "../../domain/ports/login-lockout.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type { PasswordResetRepository } from "../../domain/ports/password-reset.repository.js";
import type { TotpPort } from "../../domain/ports/totp.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import type { ResetPasswordCommand } from "../dto/reset-password.command.js";
import { InvalidateAllSessionsUseCase } from "./invalidate-all-sessions.use-case.js";

export type ResetPasswordDeps = {
  hashToken: (token: string) => string;
};

export class ResetPasswordUseCase {
  constructor(
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly loginLockout: LoginLockoutPort,
    private readonly totp: TotpPort,
    private readonly invalidateAllSessions: InvalidateAllSessionsUseCase,
    private readonly deps: ResetPasswordDeps,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<{ message: string }> {
    const tokenHash = this.deps.hashToken(command.token);
    const row = await this.passwordResetRepository.findByTokenHash(tokenHash);

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      await this.passwordHasher.authFailureDelay();
      throw new PasswordResetInvalidError();
    }

    const user = row.user;

    if (this.loginLockout.isLoginLocked(user.lockedUntil)) {
      await this.passwordHasher.authFailureDelay();
      throw new AuthTooManyRequestsError(this.loginLockout.lockoutMessage(user.lockedUntil!));
    }

    if (user.totpEnabledAt) {
      if (!command.code) {
        throw new TwoFactorRequiredError(
          "Informe o código do autenticador para redefinir a senha.",
        );
      }

      const secret = user.totpSecretEnc ? this.totp.decryptSecret(user.totpSecretEnc) : null;
      if (!secret || !(await this.totp.verifyCode(secret, command.code))) {
        await this.userRepository.updateLoginLockout(
          user.id,
          this.loginLockout.nextFailedLoginState(user.failedLoginAttempts),
        );
        throw new TwoFactorRequiredError();
      }
    }

    const passwordHash = await this.passwordHasher.hash(command.password);

    await this.passwordResetRepository.completePasswordReset(row.id, row.userId, passwordHash);

    await this.invalidateAllSessions.execute(row.userId);

    return { message: "Senha redefinida. Você já pode entrar com a nova senha." };
  }
}

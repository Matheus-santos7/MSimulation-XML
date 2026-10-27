import { Inject, Injectable } from "@nestjs/common";
import { AuthError } from "../../errors/auth.errors.js";
import { LoginLockoutProvider } from "../../providers/login-lockout.provider.js";
import { OpaqueTokenProvider } from "../../providers/opaque-token.provider.js";
import { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import { TotpProvider } from "../../providers/totp.provider.js";
import { InvalidateAllSessionsUseCase } from "../../session/use-cases/invalidate-all-sessions.usecase.js";
import { UserRepository } from "../../user/user.repository.js";
import type { ResetPasswordRequestDTO } from "../dtos/reset-password.request.dto.js";
import { PasswordResetRepository } from "../password-reset.repository.js";

/**
 * Redefine a senha com o token do e-mail. Com 2FA ativo, exige o código TOTP.
 * Depois de redefinir, invalida todas as sessões.
 *
 * @throws {AuthError.PasswordResetInvalid} Token inválido, usado ou expirado
 * @throws {AuthError.TwoFactorRequired} 2FA ativo sem código ou com código inválido
 * @throws {AuthError.TooManyRequests} Conta bloqueada
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(PasswordResetRepository)
    private readonly passwordResetRepository: PasswordResetRepository,
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(PasswordHasherProvider) private readonly passwordHasher: PasswordHasherProvider,
    @Inject(LoginLockoutProvider) private readonly loginLockout: LoginLockoutProvider,
    @Inject(TotpProvider) private readonly totp: TotpProvider,
    @Inject(InvalidateAllSessionsUseCase)
    private readonly invalidateAllSessions: InvalidateAllSessionsUseCase,
    @Inject(OpaqueTokenProvider) private readonly tokens: OpaqueTokenProvider,
  ) {}

  async execute(command: Pick<ResetPasswordRequestDTO, "token" | "password" | "code">): Promise<{
    message: string;
  }> {
    const tokenHash = this.tokens.hashPasswordResetToken(command.token);
    const row = await this.passwordResetRepository.findByTokenHash(tokenHash);
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      await this.passwordHasher.authFailureDelay();
      throw new AuthError.PasswordResetInvalid();
    }

    const user = row.user;
    if (this.loginLockout.isLoginLocked(user.lockedUntil)) {
      await this.passwordHasher.authFailureDelay();
      throw new AuthError.TooManyRequests(this.loginLockout.lockoutMessage(user.lockedUntil!));
    }

    if (user.totpEnabledAt) {
      if (!command.code) {
        throw new AuthError.TwoFactorRequired(
          "Informe o código do autenticador para redefinir a senha.",
        );
      }
      const secret = user.totpSecretEnc ? this.totp.decryptSecret(user.totpSecretEnc) : null;
      if (!secret || !(await this.totp.verifyCode(secret, command.code))) {
        await this.userRepository.updateLoginLockout(
          user.id,
          this.loginLockout.nextFailedLoginState(user.failedLoginAttempts),
        );
        throw new AuthError.TwoFactorRequired();
      }
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    await this.passwordResetRepository.completePasswordReset(row.id, row.userId, passwordHash);
    await this.invalidateAllSessions.execute(row.userId);

    return { message: "Senha redefinida. Você já pode entrar com a nova senha." };
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { AuthTokenService } from "../../auth-token.service.js";
import { AuthError } from "../../errors/auth.errors.js";
import { LoginLockoutProvider } from "../../providers/login-lockout.provider.js";
import { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import { UserRepository } from "../../user/user.repository.js";
import type { LoginRequestDTO } from "../dtos/login.request.dto.js";
import type { AuthMeta, LoginResponse } from "../session.types.js";
import { FinishLoginUseCase } from "./finish-login.usecase.js";

/**
 * Autentica por e-mail e senha.
 *
 * Aplica lockout progressivo nas falhas, gasta o mesmo tempo com hash fictício quando o e-mail
 * não existe e, com 2FA ativo, devolve o desafio em vez da sessão.
 *
 * @throws {AuthError.TooManyRequests} Conta bloqueada pelo lockout
 * @throws {AuthError.Unauthorized} Credenciais inválidas
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(PasswordHasherProvider) private readonly passwordHasher: PasswordHasherProvider,
    @Inject(LoginLockoutProvider) private readonly loginLockout: LoginLockoutProvider,
    @Inject(AuthTokenService) private readonly authTokens: AuthTokenService,
    @Inject(FinishLoginUseCase) private readonly finishLogin: FinishLoginUseCase,
  ) {}

  async execute(
    command: Pick<LoginRequestDTO, "email" | "password">,
    meta: AuthMeta = {},
  ): Promise<LoginResponse> {
    const normalizedEmail = command.email.toLowerCase().trim();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (user && this.loginLockout.isLoginLocked(user.lockedUntil)) {
      await this.passwordHasher.authFailureDelay();
      throw new AuthError.TooManyRequests(this.loginLockout.lockoutMessage(user.lockedUntil!));
    }

    const storedHash = user?.password ?? this.passwordHasher.dummyPasswordHash;
    const isValidPassword = await this.passwordHasher.verify(command.password, storedHash);

    if (!user || !isValidPassword) {
      if (user) {
        await this.userRepository.updateLoginLockout(
          user.id,
          this.loginLockout.nextFailedLoginState(user.failedLoginAttempts),
        );
      }
      await this.passwordHasher.authFailureDelay();
      throw new AuthError.Unauthorized();
    }

    await this.userRepository.clearLoginLockout(user.id);

    if (user.totpEnabledAt) {
      return this.authTokens.buildTwoFactorChallenge(user);
    }

    return this.finishLogin.execute(user.id, meta);
  }
}

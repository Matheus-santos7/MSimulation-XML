import type { LoginResponse } from "../../domain/entities/auth-session.entity.js";
import { AuthTooManyRequestsError } from "../../domain/errors/auth-too-many-requests.error.js";
import { AuthUnauthorizedError } from "../../domain/errors/auth-unauthorized.error.js";
import type { LoginLockoutPort } from "../../domain/ports/login-lockout.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type {
  AuthMeta,
  SessionResponsePort,
  SignAccessToken,
  SignTwoFactorPendingToken,
} from "../../domain/ports/session-response.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import type { LoginCommand } from "../dto/login.command.js";
import { FinishLoginUseCase } from "./finish-login.use-case.js";

/**
 * Autentica utilizador por e-mail e senha.
 *
 * Aplica lockout progressivo em falhas, timing-safe com hash dummy quando o e-mail
 * não existe e bifurca para desafio 2FA ou {@link FinishLoginUseCase}.
 *
 * @param command - E-mail e senha em texto
 * @param signAccess - Função que assina JWT de acesso
 * @param meta - User-Agent e IP para auditoria da sessão
 * @param signTwoFactorPending - Assina JWT temporário se 2FA ativo
 * @returns Sessão completa ou desafio `requiresTwoFactor`
 * @throws {AuthTooManyRequestsError} Conta bloqueada por lockout
 * @throws {AuthUnauthorizedError} Credenciais inválidas
 */
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly loginLockout: LoginLockoutPort,
    private readonly sessionResponse: SessionResponsePort,
    private readonly finishLogin: FinishLoginUseCase,
  ) {}

  async execute(
    command: LoginCommand,
    signAccess: SignAccessToken,
    meta: AuthMeta = {},
    signTwoFactorPending?: SignTwoFactorPendingToken,
  ): Promise<LoginResponse> {
    const normalizedEmail = command.email.toLowerCase().trim();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (user && this.loginLockout.isLoginLocked(user.lockedUntil)) {
      await this.passwordHasher.authFailureDelay();
      throw new AuthTooManyRequestsError(this.loginLockout.lockoutMessage(user.lockedUntil!));
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
      throw new AuthUnauthorizedError();
    }

    await this.userRepository.clearLoginLockout(user.id);

    if (user.totpEnabledAt && signTwoFactorPending) {
      return this.sessionResponse.buildLoginTwoFactorChallenge(signTwoFactorPending, user);
    }

    return this.finishLogin.execute(user.id, meta, signAccess);
  }
}

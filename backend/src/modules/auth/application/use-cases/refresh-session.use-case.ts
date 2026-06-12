import type { AuthSessionResponse } from "../../domain/entities/auth-session.entity.js";
import { AuthUnauthorizedError } from "../../domain/errors/auth-unauthorized.error.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type { RefreshTokenPort } from "../../domain/ports/refresh-token.port.js";
import type {
  AuthMeta,
  SignAccessToken,
} from "../../domain/ports/session-response.port.js";
import type { UserSessionRepository } from "../../domain/ports/user-session.repository.js";
import { FinishLoginUseCase } from "./finish-login.use-case.js";

export class RefreshSessionUseCase {
  constructor(
    private readonly userSessionRepository: UserSessionRepository,
    private readonly refreshTokenPort: RefreshTokenPort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly finishLogin: FinishLoginUseCase,
  ) {}

  async execute(
    refreshToken: string,
    signAccess: SignAccessToken,
    meta: AuthMeta = {},
  ): Promise<AuthSessionResponse> {
    const session = await this.findActiveSession(refreshToken);
    if (!session) {
      await this.passwordHasher.authFailureDelay();
      throw new AuthUnauthorizedError("Sessão expirada. Entre novamente.");
    }

    await this.userSessionRepository.revokeById(session.id);

    return this.finishLogin.execute(session.userId, meta, signAccess);
  }

  private async findActiveSession(refreshToken: string) {
    const hash = this.refreshTokenPort.hash(refreshToken);
    const session = await this.userSessionRepository.findActiveByRefreshTokenHash(hash);
    if (!session) return null;
    return session;
  }
}

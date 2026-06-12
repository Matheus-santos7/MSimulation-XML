import type { AuthSessionResponse } from "../../domain/entities/auth-session.entity.js";
import { AuthUnauthorizedError } from "../../domain/errors/auth-unauthorized.error.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import type { UserSessionRepository } from "../../domain/ports/user-session.repository.js";
import type { RefreshTokenPort } from "../../domain/ports/refresh-token.port.js";
import type {
  AuthMeta,
  SessionResponsePort,
  SignAccessToken,
} from "../../domain/ports/session-response.port.js";
/**
 * Finaliza autenticação: cria sessão com refresh token e monta resposta com access JWT.
 *
 * Usado após login, 2FA, registo, refresh, refresh rotacionado e onboarding.
 *
 * @param userId - ID do utilizador autenticado
 * @param meta - Metadados da sessão (user-agent, IP)
 * @param signAccess - Assina access token com `userId`, `tenantId`, `tokenVersion`
 * @returns {@link AuthSessionResponse}
 * @throws {AuthUnauthorizedError} Utilizador não encontrado
 */
export class FinishLoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userSessionRepository: UserSessionRepository,
    private readonly refreshTokenPort: RefreshTokenPort,
    private readonly sessionResponse: SessionResponsePort,
    private readonly refreshTokenTtlMs: number,
  ) {}

  async execute(
    userId: string,
    meta: AuthMeta,
    signAccess: SignAccessToken,
  ): Promise<AuthSessionResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AuthUnauthorizedError();
    }

    const refreshToken = await this.createSession(userId, meta);

    return this.sessionResponse.buildAuthSession(
      signAccess,
      refreshToken,
      user,
      user.tenant,
      user.tokenVersion,
    );
  }

  private async createSession(userId: string, meta: AuthMeta): Promise<string> {
    const refreshToken = this.refreshTokenPort.generate();
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlMs);

    await this.userSessionRepository.createSession({
      userId,
      refreshTokenHash: this.refreshTokenPort.hash(refreshToken),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 512),
      ipAddress: meta.ipAddress?.slice(0, 64),
    });

    return refreshToken;
  }
}

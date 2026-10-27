import { Inject, Injectable } from "@nestjs/common";
import { AuthError } from "../../errors/auth.errors.js";
import { OpaqueTokenProvider } from "../../providers/opaque-token.provider.js";
import { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import type { AuthMeta, AuthSessionResponse } from "../session.types.js";
import { UserSessionRepository } from "../user-session.repository.js";
import { FinishLoginUseCase } from "./finish-login.usecase.js";

/**
 * Renova a sessão pelo refresh token, com rotação: revoga a sessão antiga e emite outra.
 *
 * @throws {AuthError.Unauthorized} Refresh inválido, revogado ou expirado
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(UserSessionRepository) private readonly userSessionRepository: UserSessionRepository,
    @Inject(OpaqueTokenProvider) private readonly tokens: OpaqueTokenProvider,
    @Inject(PasswordHasherProvider) private readonly passwordHasher: PasswordHasherProvider,
    @Inject(FinishLoginUseCase) private readonly finishLogin: FinishLoginUseCase,
  ) {}

  async execute(refreshToken: string, meta: AuthMeta = {}): Promise<AuthSessionResponse> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.userSessionRepository.findActiveByRefreshTokenHash(hash);
    if (!session) {
      await this.passwordHasher.authFailureDelay();
      throw new AuthError.Unauthorized("Sessão expirada. Entre novamente.");
    }

    await this.userSessionRepository.revokeById(session.id);

    return this.finishLogin.execute(session.userId, meta);
  }
}

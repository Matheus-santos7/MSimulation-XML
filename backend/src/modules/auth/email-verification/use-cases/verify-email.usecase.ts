import { Inject, Injectable } from "@nestjs/common";
import { AuthError } from "../../errors/auth.errors.js";
import { OpaqueTokenProvider } from "../../providers/opaque-token.provider.js";
import { EmailVerificationRepository } from "../email-verification.repository.js";

/**
 * Confirma o e-mail com o token do link.
 *
 * @throws {AuthError.EmailVerificationInvalid} Token inválido, usado ou expirado
 */
@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(EmailVerificationRepository)
    private readonly emailVerificationRepository: EmailVerificationRepository,
    @Inject(OpaqueTokenProvider) private readonly tokens: OpaqueTokenProvider,
  ) {}

  async execute(token: string): Promise<{ message: string }> {
    const tokenHash = this.tokens.hashEmailVerificationToken(token);
    const row = await this.emailVerificationRepository.findByTokenHash(tokenHash);
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new AuthError.EmailVerificationInvalid();
    }

    await this.emailVerificationRepository.confirmEmailVerification(row.id, row.userId);

    return { message: "E-mail confirmado. Você já pode continuar." };
  }
}

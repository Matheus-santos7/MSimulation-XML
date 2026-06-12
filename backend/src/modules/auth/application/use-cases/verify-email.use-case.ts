import { EmailVerificationInvalidError } from "../../domain/errors/email-verification-invalid.error.js";
import type { EmailVerificationRepository } from "../../domain/ports/email-verification.repository.js";

export type VerifyEmailDeps = {
  hashToken: (token: string) => string;
};

/**
 * Confirma e-mail do utilizador com token da URL de verificação.
 *
 * @param token - Token em claro recebido por query string
 * @returns Mensagem de sucesso
 * @throws {EmailVerificationInvalidError} Token inválido, usado ou expirado
 */
export class VerifyEmailUseCase {
  constructor(
    private readonly emailVerificationRepository: EmailVerificationRepository,
    private readonly deps: VerifyEmailDeps,
  ) {}

  async execute(token: string): Promise<{ message: string }> {
    const tokenHash = this.deps.hashToken(token);
    const row = await this.emailVerificationRepository.findByTokenHash(tokenHash);

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new EmailVerificationInvalidError();
    }

    await this.emailVerificationRepository.confirmEmailVerification(row.id, row.userId);

    return { message: "E-mail confirmado. Você já pode continuar." };
  }
}

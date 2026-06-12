import { EmailVerificationInvalidError } from "../../domain/errors/email-verification-invalid.error.js";
import type { EmailVerificationRepository } from "../../domain/ports/email-verification.repository.js";

export type VerifyEmailDeps = {
  hashToken: (token: string) => string;
};

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

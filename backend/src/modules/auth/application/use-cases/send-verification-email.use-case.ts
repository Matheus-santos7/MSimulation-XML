import type { EmailSenderPort } from "../../domain/ports/email-sender.port.js";
import type { EmailVerificationRepository } from "../../domain/ports/email-verification.repository.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";

export type SendVerificationEmailDeps = {
  appPublicUrl: string;
  emailVerificationTtlMs: number;
  requireEmailVerification: boolean;
  generateToken: () => string;
  hashToken: (token: string) => string;
};

/**
 * Gera token de verificação e envia e-mail (uso interno e reenvio).
 *
 * No-op se verificação desativada no ambiente ou e-mail já confirmado.
 *
 * @param userId - ID do utilizador a verificar
 */
export class SendVerificationEmailUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailVerificationRepository: EmailVerificationRepository,
    private readonly emailSender: EmailSenderPort,
    private readonly deps: SendVerificationEmailDeps,
  ) {}

  async execute(userId: string): Promise<void> {
    if (!this.deps.requireEmailVerification) return;

    const user = await this.userRepository.findAuthUserById(userId);
    if (!user || user.emailVerifiedAt) return;

    const plainToken = this.deps.generateToken();
    const tokenHash = this.deps.hashToken(plainToken);
    const expiresAt = new Date(Date.now() + this.deps.emailVerificationTtlMs);

    await this.emailVerificationRepository.replacePendingToken(user.id, tokenHash, expiresAt);

    const verifyUrl = `${this.deps.appPublicUrl}/login/verificar-email?token=${encodeURIComponent(plainToken)}`;
    const expiresHours = Math.max(1, Math.round(this.deps.emailVerificationTtlMs / 3_600_000));

    await this.emailSender.sendEmailVerification({
      to: user.email,
      verifyUrl,
      expiresHours,
      recipientName: user.name,
      idempotencyKey: `email-verify/${tokenHash}`,
    });
  }
}

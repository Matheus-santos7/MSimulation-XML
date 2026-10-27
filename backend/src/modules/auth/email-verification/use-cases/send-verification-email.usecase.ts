import { Inject, Injectable } from "@nestjs/common";
import { AuthSettings } from "../../auth.settings.js";
import { EmailSenderProvider } from "../../providers/email-sender.provider.js";
import { OpaqueTokenProvider } from "../../providers/opaque-token.provider.js";
import { UserRepository } from "../../user/user.repository.js";
import { EmailVerificationRepository } from "../email-verification.repository.js";

const MS_PER_HOUR = 3_600_000;

/**
 * Gera o token de confirmação e envia o e-mail (cadastro e reenvio).
 * Não faz nada com a verificação desligada no ambiente ou com o e-mail já confirmado.
 */
@Injectable()
export class SendVerificationEmailUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(EmailVerificationRepository)
    private readonly emailVerificationRepository: EmailVerificationRepository,
    @Inject(EmailSenderProvider) private readonly emailSender: EmailSenderProvider,
    @Inject(OpaqueTokenProvider) private readonly tokens: OpaqueTokenProvider,
    @Inject(AuthSettings) private readonly settings: AuthSettings,
  ) {}

  async execute(userId: string): Promise<void> {
    if (!this.settings.requireEmailVerification) return;

    const user = await this.userRepository.findAuthUserById(userId);
    if (!user || user.emailVerifiedAt) return;

    const ttlMs = this.settings.emailVerificationTtlMs;
    const plainToken = this.tokens.generateEmailVerificationToken();
    const tokenHash = this.tokens.hashEmailVerificationToken(plainToken);
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.emailVerificationRepository.replacePendingToken(user.id, tokenHash, expiresAt);

    await this.emailSender.sendEmailVerification({
      to: user.email,
      verifyUrl: `${this.settings.appPublicUrl}/login/verificar-email?token=${encodeURIComponent(plainToken)}`,
      expiresHours: Math.max(1, Math.round(ttlMs / MS_PER_HOUR)),
      recipientName: user.name,
      idempotencyKey: `email-verify/${tokenHash}`,
    });
  }
}

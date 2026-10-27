import { Inject, Injectable } from "@nestjs/common";
import { AuthSettings } from "../../auth.settings.js";
import { AuthError } from "../../errors/auth.errors.js";
import { EmailSenderProvider } from "../../providers/email-sender.provider.js";
import { OpaqueTokenProvider } from "../../providers/opaque-token.provider.js";
import { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import { UserRepository } from "../../user/user.repository.js";
import type { ForgotPasswordRequestDTO } from "../dtos/forgot-password.request.dto.js";
import { PasswordResetRepository } from "../password-reset.repository.js";

const MS_PER_MINUTE = 60_000;

/**
 * Inicia a redefinição de senha por e-mail.
 *
 * A resposta é genérica mesmo para e-mail inexistente (evita enumeração de contas). Gera token
 * opaco, guarda o hash e envia o link via Brevo.
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(PasswordResetRepository)
    private readonly passwordResetRepository: PasswordResetRepository,
    @Inject(EmailSenderProvider) private readonly emailSender: EmailSenderProvider,
    @Inject(PasswordHasherProvider) private readonly passwordHasher: PasswordHasherProvider,
    @Inject(OpaqueTokenProvider) private readonly tokens: OpaqueTokenProvider,
    @Inject(AuthSettings) private readonly settings: AuthSettings,
  ) {}

  async execute(command: Pick<ForgotPasswordRequestDTO, "email">): Promise<{ message: string }> {
    const genericResponse = { message: this.settings.passwordResetGenericMessage };
    const user = await this.userRepository.findByEmail(command.email);
    if (!user) {
      await this.passwordHasher.authFailureDelay();
      return genericResponse;
    }

    const ttlMs = this.settings.passwordResetTtlMs;
    const plainToken = this.tokens.generatePasswordResetToken();
    const tokenHash = this.tokens.hashPasswordResetToken(plainToken);
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.passwordResetRepository.replacePendingToken(user.id, tokenHash, expiresAt);

    try {
      await this.emailSender.sendPasswordReset({
        to: user.email,
        resetUrl: `${this.settings.appPublicUrl}/login/redefinir-senha?token=${encodeURIComponent(plainToken)}`,
        expiresMinutes: Math.max(1, Math.round(ttlMs / MS_PER_MINUTE)),
        recipientName: user.name,
        idempotencyKey: `password-reset/${tokenHash}`,
      });
    } catch (error) {
      // Falha de envio fica invisível para o usuário (mesma resposta genérica).
      if (!(error instanceof AuthError.EmailDelivery)) throw error;
    }

    return genericResponse;
  }
}

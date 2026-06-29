import { EmailDeliveryError } from "../../domain/errors/email-delivery.error.js";
import type { EmailSenderPort } from "../../domain/ports/email-sender.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type { PasswordResetRepository } from "../../domain/ports/password-reset.repository.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import type { ForgotPasswordCommand } from "../dto/forgot-password.command.js";

export type RequestPasswordResetDeps = {
  appPublicUrl: string;
  passwordResetTtlMs: number;
  genericMessage: string;
  generateToken: () => string;
  hashToken: (token: string) => string;
};

/**
 * Inicia fluxo de redefinição de senha por e-mail.
 *
 * Resposta genérica mesmo quando o e-mail não existe (evita enumeração de contas).
 * Gera token opaco, persiste hash e envia link via Brevo.
 *
 * @param command - E-mail do utilizador
 * @returns Mensagem genérica de confirmação
 */
export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly emailSender: EmailSenderPort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly deps: RequestPasswordResetDeps,
  ) {}

  async execute(command: ForgotPasswordCommand): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(command.email);

    if (!user) {
      await this.passwordHasher.authFailureDelay();
      return { message: this.deps.genericMessage };
    }

    const plainToken = this.deps.generateToken();
    const tokenHash = this.deps.hashToken(plainToken);
    const expiresAt = new Date(Date.now() + this.deps.passwordResetTtlMs);

    await this.passwordResetRepository.replacePendingToken(user.id, tokenHash, expiresAt);

    const resetUrl = `${this.deps.appPublicUrl}/login/redefinir-senha?token=${encodeURIComponent(plainToken)}`;
    const expiresMinutes = Math.max(1, Math.round(this.deps.passwordResetTtlMs / 60_000));

    try {
      await this.emailSender.sendPasswordReset({
        to: user.email,
        resetUrl,
        expiresMinutes,
        recipientName: user.name,
        idempotencyKey: `password-reset/${tokenHash}`,
      });
    } catch (error) {
      if (error instanceof EmailDeliveryError && process.env.NODE_ENV !== "production") {
        console.warn("[dev] Falha ao enviar e-mail:", error.message);
      } else if (error instanceof EmailDeliveryError) {
        console.error("Falha Brevo:", error.message);
      } else {
        throw error;
      }
    }

    return { message: this.deps.genericMessage };
  }
}

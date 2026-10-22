import { Injectable } from "@nestjs/common";
import { appConfig } from "../../../config/config.service.js";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendRegistrationAttemptAlert as sendRegistrationAttemptAlertEmail,
} from "../../../lib/brevo/brevo-email.service.js";
import { brevoApiKey } from "../../../lib/brevo/config.js";
import { AuthError } from "../errors/auth.errors.js";

export type SendPasswordResetEmailParams = {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
  recipientName?: string | null;
  idempotencyKey: string;
};

export type SendEmailVerificationParams = {
  to: string;
  verifyUrl: string;
  expiresHours: number;
  recipientName?: string | null;
  idempotencyKey: string;
};

export type SendRegistrationAttemptParams = {
  to: string;
  loginUrl: string;
  forgotPasswordUrl: string;
  recipientName?: string | null;
  idempotencyKey: string;
};

/**
 * E-mails transacionais via Brevo. Em produção, falha de envio ou chave ausente lança
 * `AuthError.EmailDelivery`; em desenvolvimento, o envio é ignorado (o link fica disponível
 * para teste manual).
 */
@Injectable()
export class EmailSenderProvider {
  async sendPasswordReset(params: SendPasswordResetEmailParams): Promise<void> {
    if (!this.ensureConfigured()) return;

    try {
      await sendPasswordResetEmail(params);
    } catch (error) {
      this.handleDeliveryError(error);
    }
  }

  async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    if (!this.ensureConfigured()) return;

    try {
      await sendEmailVerificationEmail(params);
    } catch (error) {
      this.handleDeliveryError(error);
    }
  }

  async sendRegistrationAttemptAlert(params: SendRegistrationAttemptParams): Promise<void> {
    if (!this.ensureConfigured()) return;

    try {
      await sendRegistrationAttemptAlertEmail(params);
    } catch (error) {
      this.handleDeliveryError(error);
    }
  }

  /** `false` em desenvolvimento sem `BREVO_API_KEY`: o envio é pulado. */
  private ensureConfigured(): boolean {
    if (brevoApiKey()) return true;
    if (appConfig.isProduction) throw new AuthError.EmailDelivery("BREVO_API_KEY não configurada");

    return false;
  }

  private handleDeliveryError(error: unknown): void {
    if (!appConfig.isProduction) return;

    throw new AuthError.EmailDelivery(
      error instanceof Error ? error.message : "Falha ao enviar e-mail",
    );
  }
}

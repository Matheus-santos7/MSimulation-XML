import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendRegistrationAttemptAlert as sendRegistrationAttemptAlertEmail,
} from "../../../../lib/brevo/brevo-email.service.js";
import { brevoApiKey } from "../../../../lib/brevo/config.js";
import { EmailDeliveryError } from "../../domain/errors/email-delivery.error.js";
import type {
  EmailSenderPort,
  SendEmailVerificationParams,
  SendPasswordResetEmailParams,
  SendRegistrationAttemptParams,
} from "../../domain/ports/email-sender.port.js";

/**
 * Adapter de envio de e-mails transacionais via Brevo.
 */
export class BrevoEmailAdapter implements EmailSenderPort {
  private logDevEmailFallback(label: string, to: string, url: string): void {
    console.info(
      `[dev] ${label} (copie o link se o Brevo não entregou):\n`,
      `  Para: ${to}\n`,
      `  Link: ${url}\n`,
    );
  }

  private handleDeliveryError(error: unknown, fallback: { label: string; to: string; url: string }): void {
    const message = error instanceof Error ? error.message : "Falha ao enviar e-mail";

    if (process.env.NODE_ENV === "production") {
      throw new EmailDeliveryError(message);
    }

    console.warn("[dev] Falha ao enviar e-mail:", message);
    this.logDevEmailFallback(fallback.label, fallback.to, fallback.url);
  }

  private ensureConfiguredOrDevFallback(
    fallback: { label: string; to: string; url: string },
  ): boolean {
    if (brevoApiKey()) return true;

    if (process.env.NODE_ENV === "production") {
      throw new EmailDeliveryError("BREVO_API_KEY não configurada");
    }

    this.logDevEmailFallback(`${fallback.label} (BREVO_API_KEY ausente)`, fallback.to, fallback.url);
    return false;
  }

  async sendPasswordReset(params: SendPasswordResetEmailParams): Promise<void> {
    if (!this.ensureConfiguredOrDevFallback({
      label: "E-mail de reset",
      to: params.to,
      url: params.resetUrl,
    })) {
      return;
    }

    try {
      await sendPasswordResetEmail(params);
    } catch (error) {
      this.handleDeliveryError(error, {
        label: "E-mail de reset",
        to: params.to,
        url: params.resetUrl,
      });
    }
  }

  async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    if (!this.ensureConfiguredOrDevFallback({
      label: "E-mail de verificação",
      to: params.to,
      url: params.verifyUrl,
    })) {
      return;
    }

    try {
      await sendEmailVerificationEmail(params);
    } catch (error) {
      this.handleDeliveryError(error, {
        label: "E-mail de verificação",
        to: params.to,
        url: params.verifyUrl,
      });
    }
  }

  async sendRegistrationAttemptAlert(params: SendRegistrationAttemptParams): Promise<void> {
    if (!this.ensureConfiguredOrDevFallback({
      label: "Alerta de tentativa de cadastro",
      to: params.to,
      url: params.loginUrl,
    })) {
      return;
    }

    try {
      await sendRegistrationAttemptAlertEmail(params);
    } catch (error) {
      this.handleDeliveryError(error, {
        label: "Alerta de tentativa de cadastro",
        to: params.to,
        url: params.loginUrl,
      });
    }
  }
}

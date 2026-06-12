import { Resend } from "resend";
import { buildEmailVerificationEmailHtml } from "../../../../emails/templates/email-verification-email.js";
import { buildPasswordResetEmailHtml } from "../../../../emails/templates/password-reset-email.js";
import { resendApiKey, resendFromEmail } from "../../../../lib/auth/config.js";
import { BRAND_FULL_NAME } from "../../../../lib/brand.js";
import { EmailDeliveryError } from "../../domain/errors/email-delivery.error.js";
import type {
  EmailSenderPort,
  SendEmailVerificationParams,
  SendPasswordResetEmailParams,
} from "../../domain/ports/email-sender.port.js";

export class ResendEmailAdapter implements EmailSenderPort {
  private readonly resend: Resend | null;

  constructor() {
    const key = resendApiKey();
    this.resend = key ? new Resend(key) : null;
  }

  private logDevEmailFallback(label: string, to: string, url: string): void {
    console.info(
      `[dev] ${label} (copie o link se o Resend não entregou):\n`,
      `  Para: ${to}\n`,
      `  Link: ${url}\n`,
    );
  }

  private handleResendError(
    error: { message: string },
    fallback: { label: string; to: string; url: string },
  ): void {
    if (process.env.NODE_ENV === "production") {
      throw new EmailDeliveryError(error.message);
    }
    console.warn("[dev] Falha ao enviar e-mail:", error.message);
    this.logDevEmailFallback(fallback.label, fallback.to, fallback.url);
  }

  async sendPasswordReset(params: SendPasswordResetEmailParams): Promise<void> {
    const subject = `Redefinir senha — ${BRAND_FULL_NAME}`;
    const html = buildPasswordResetEmailHtml({
      resetUrl: params.resetUrl,
      expiresMinutes: params.expiresMinutes,
      recipientName: params.recipientName,
    });

    if (!this.resend) {
      if (process.env.NODE_ENV === "production") {
        throw new EmailDeliveryError("RESEND_API_KEY não configurada");
      }
      this.logDevEmailFallback("E-mail de reset (RESEND_API_KEY ausente)", params.to, params.resetUrl);
      return;
    }

    const { error } = await this.resend.emails.send(
      {
        from: resendFromEmail(),
        to: [params.to],
        subject,
        html,
      },
      { idempotencyKey: params.idempotencyKey },
    );

    if (error) {
      this.handleResendError(error, {
        label: "E-mail de reset",
        to: params.to,
        url: params.resetUrl,
      });
    }
  }

  async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    const subject = `Confirmar e-mail — ${BRAND_FULL_NAME}`;
    const html = buildEmailVerificationEmailHtml({
      verifyUrl: params.verifyUrl,
      expiresHours: params.expiresHours,
      recipientName: params.recipientName,
    });

    if (!this.resend) {
      if (process.env.NODE_ENV === "production") {
        throw new EmailDeliveryError("RESEND_API_KEY não configurada");
      }
      this.logDevEmailFallback(
        "E-mail de verificação (RESEND_API_KEY ausente)",
        params.to,
        params.verifyUrl,
      );
      return;
    }

    const { error } = await this.resend.emails.send(
      {
        from: resendFromEmail(),
        to: [params.to],
        subject,
        html,
      },
      { idempotencyKey: params.idempotencyKey },
    );

    if (error) {
      this.handleResendError(error, {
        label: "E-mail de verificação",
        to: params.to,
        url: params.verifyUrl,
      });
    }
  }
}

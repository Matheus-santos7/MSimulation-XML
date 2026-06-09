import { Resend } from "resend";
import { buildPasswordResetEmailHtml } from "../../../emails/auth/password-reset-email.js";
import { buildEmailVerificationEmailHtml } from "../../../emails/auth/email-verification-email.js";
import { BRAND_FULL_NAME } from "../../../lib/auth/brand.js";
import { resendApiKey, resendFromEmail } from "../../../lib/auth/config.js";

export type SendPasswordResetParams = {
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

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export class EmailService {
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

  async sendPasswordReset(params: SendPasswordResetParams): Promise<void> {
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

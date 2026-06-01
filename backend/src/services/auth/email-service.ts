import { Resend } from "resend";
import { buildPasswordResetEmailHtml } from "../../emails/auth/password-reset-email.js";
import { BRAND_FULL_NAME } from "../../lib/auth/brand.js";
import { resendApiKey, resendFromEmail } from "../../lib/auth/config.js";

export type SendPasswordResetParams = {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
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
      console.info(
        "[dev] E-mail de reset (RESEND_API_KEY ausente):\n",
        `  Para: ${params.to}\n`,
        `  Link: ${params.resetUrl}\n`,
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
      throw new EmailDeliveryError(error.message);
    }
  }
}

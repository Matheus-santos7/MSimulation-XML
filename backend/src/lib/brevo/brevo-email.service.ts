import { buildEmailVerificationEmailHtml } from "../emails/templates/email-verification-email.js";
import { buildPasswordResetEmailHtml } from "../emails/templates/password-reset-email.js";
import { buildRegistrationAttemptEmailHtml } from "../emails/templates/registration-attempt-email.js";
import { BRAND_FULL_NAME } from "../brand.js";
import { getBrevoClient } from "./brevo-client.js";
import { brevoSenderEmail, brevoSenderName } from "./config.js";
import { mapBrevoErrorToMessage } from "./brevo-error.js";

export type SendTransactionalEmailInput = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  idempotencyKey?: string;
};

/**
 * Envia e-mail transacional via Brevo.
 */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<void> {
  const client = getBrevoClient();
  if (!client) {
    throw new Error("BREVO_API_KEY não configurada");
  }

  try {
    await client.transactionalEmails.sendTransacEmail(
      {
        sender: {
          email: brevoSenderEmail(),
          name: brevoSenderName(),
        },
        to: [
          {
            email: input.to,
            ...(input.toName?.trim() ? { name: input.toName.trim() } : {}),
          },
        ],
        subject: input.subject,
        htmlContent: input.html,
      },
      input.idempotencyKey
        ? { headers: { "Idempotency-Key": input.idempotencyKey } }
        : undefined,
    );
  } catch (error) {
    const message = mapBrevoErrorToMessage(error);
    console.error("[brevo] Falha ao enviar e-mail transacional:", message);
    throw new Error(message);
  }
}

export type SendPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
  recipientName?: string | null;
  idempotencyKey: string;
};

/** Envia e-mail de redefinição de senha. */
export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void> {
  await sendTransactionalEmail({
    to: input.to,
    toName: input.recipientName,
    subject: `Redefinir senha — ${BRAND_FULL_NAME}`,
    html: buildPasswordResetEmailHtml({
      resetUrl: input.resetUrl,
      expiresMinutes: input.expiresMinutes,
      recipientName: input.recipientName,
    }),
    idempotencyKey: input.idempotencyKey,
  });
}

export type SendEmailVerificationInput = {
  to: string;
  verifyUrl: string;
  expiresHours: number;
  recipientName?: string | null;
  idempotencyKey: string;
};

/** Envia e-mail de confirmação de endereço. */
export async function sendEmailVerificationEmail(input: SendEmailVerificationInput): Promise<void> {
  await sendTransactionalEmail({
    to: input.to,
    toName: input.recipientName,
    subject: `Confirmar e-mail — ${BRAND_FULL_NAME}`,
    html: buildEmailVerificationEmailHtml({
      verifyUrl: input.verifyUrl,
      expiresHours: input.expiresHours,
      recipientName: input.recipientName,
    }),
    idempotencyKey: input.idempotencyKey,
  });
}

export type SendRegistrationAttemptAlertInput = {
  to: string;
  loginUrl: string;
  forgotPasswordUrl: string;
  recipientName?: string | null;
  idempotencyKey: string;
};

/** Notifica titular da conta sobre tentativa de cadastro com e-mail já existente. */
export async function sendRegistrationAttemptAlert(
  input: SendRegistrationAttemptAlertInput,
): Promise<void> {
  await sendTransactionalEmail({
    to: input.to,
    toName: input.recipientName,
    subject: `Tentativa de cadastro — ${BRAND_FULL_NAME}`,
    html: buildRegistrationAttemptEmailHtml({
      loginUrl: input.loginUrl,
      forgotPasswordUrl: input.forgotPasswordUrl,
      recipientName: input.recipientName,
    }),
    idempotencyKey: input.idempotencyKey,
  });
}

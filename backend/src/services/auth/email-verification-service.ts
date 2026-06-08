import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  appPublicUrl,
  EMAIL_VERIFICATION_GENERIC_MESSAGE,
  emailVerificationTtlMs,
} from "../../lib/auth/config.js";
import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from "../../lib/auth/email-verification-token.js";
import { buildEmailVerificationEmailHtml } from "../../emails/auth/email-verification-email.js";
import { EmailDeliveryError, EmailService } from "./email-service.js";

export class EmailVerificationInvalidError extends Error {
  constructor(message = "Link inválido ou expirado. Solicite um novo e-mail.") {
    super(message);
    this.name = "EmailVerificationInvalidError";
  }
}

export class EmailVerificationService {
  private readonly email = new EmailService();

  constructor(private readonly prisma: PrismaClient) {}

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) return;

    const plainToken = generateEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(plainToken);
    const expiresAt = new Date(Date.now() + emailVerificationTtlMs());

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const verifyUrl = `${appPublicUrl()}/login/verificar-email?token=${encodeURIComponent(plainToken)}`;
    const expiresHours = Math.max(1, Math.round(emailVerificationTtlMs() / 3_600_000));

    await this.email.sendEmailVerification({
      to: user.email,
      verifyUrl,
      expiresHours,
      recipientName: user.name,
      idempotencyKey: `email-verify/${tokenHash}`,
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = hashEmailVerificationToken(token);
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new EmailVerificationInvalidError();
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    return { message: "E-mail confirmado. Você já pode continuar." };
  }

  async resendForUser(userId: string): Promise<{ message: string }> {
    try {
      await this.sendVerificationEmail(userId);
    } catch (e) {
      if (e instanceof EmailDeliveryError && process.env.NODE_ENV !== "production") {
        console.warn("[dev] Falha ao enviar e-mail de verificação:", e.message);
      } else if (e instanceof EmailDeliveryError) {
        console.error("Falha Resend (verificação):", e.message);
      } else {
        throw e;
      }
    }
    return { message: EMAIL_VERIFICATION_GENERIC_MESSAGE };
  }
}

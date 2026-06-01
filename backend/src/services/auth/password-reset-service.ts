import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  appPublicUrl,
  PASSWORD_RESET_GENERIC_MESSAGE,
  passwordResetTtlMs,
} from "../../lib/auth/config.js";
import { authFailureDelay } from "../../lib/auth/password.js";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "../../lib/auth/password-reset-token.js";
import { clearedLockoutState } from "../../lib/auth/login-lockout.js";
import { hashPassword } from "../../lib/auth/password.js";
import type { resetPasswordBodySchema, forgotPasswordBodySchema } from "../../schemas/auth/schemas.js";
import type { z } from "zod";
import { AuthService } from "./auth-service.js";
import { EmailDeliveryError, EmailService } from "./email-service.js";

type ForgotInput = z.infer<typeof forgotPasswordBodySchema>;
type ResetInput = z.infer<typeof resetPasswordBodySchema>;

export class PasswordResetInvalidError extends Error {
  constructor(message = "Link inválido ou expirado. Solicite um novo e-mail.") {
    super(message);
    this.name = "PasswordResetInvalidError";
  }
}

export class PasswordResetService {
  private readonly email = new EmailService();
  private readonly auth: AuthService;

  constructor(private readonly prisma: PrismaClient) {
    this.auth = new AuthService(prisma);
  }

  async requestReset(input: ForgotInput): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      await authFailureDelay();
      return { message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    const plainToken = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(plainToken);
    const expiresAt = new Date(Date.now() + passwordResetTtlMs());

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const resetUrl = `${appPublicUrl()}/login/redefinir-senha?token=${encodeURIComponent(plainToken)}`;
    const expiresMinutes = Math.max(1, Math.round(passwordResetTtlMs() / 60_000));

    try {
      await this.email.sendPasswordReset({
        to: user.email,
        resetUrl,
        expiresMinutes,
        recipientName: user.name,
        idempotencyKey: `password-reset/${tokenHash}`,
      });
    } catch (e) {
      if (e instanceof EmailDeliveryError && process.env.NODE_ENV !== "production") {
        console.warn("[dev] Falha ao enviar e-mail:", e.message);
      } else if (e instanceof EmailDeliveryError) {
        console.error("Falha Resend:", e.message);
      } else {
        throw e;
      }
    }

    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  async resetPassword(input: ResetInput): Promise<{ message: string }> {
    const tokenHash = hashPasswordResetToken(input.token);
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      await authFailureDelay();
      throw new PasswordResetInvalidError();
    }

    const passwordHash = await hashPassword(input.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: row.userId },
        data: {
          password: passwordHash,
          ...clearedLockoutState(),
          totpSecretEnc: null,
          totpEnabledAt: null,
        },
      });
    });

    await this.auth.invalidateAllSessions(row.userId);

    return { message: "Senha redefinida. Você já pode entrar com a nova senha." };
  }
}

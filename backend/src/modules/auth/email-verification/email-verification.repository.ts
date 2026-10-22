import { Injectable } from "@nestjs/common";
import { getDbClient } from "../../../lib/db/tenant-rls.js";

/**
 * Implementação Prisma de tokens de verificação de e-mail.
 *
 * Um token pendente por utilizador; confirmação define `emailVerifiedAt`.
 */
export type EmailVerificationTokenRecord = {
  id: string;
  userId: string;
  usedAt: Date | null;
  expiresAt: Date;
};

@Injectable()
export class EmailVerificationRepository {
  private get db() {
    return getDbClient();
  }

  /** Invalida tokens anteriores e cria novo token de verificação. */
  async replacePendingToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.db.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  /** Busca registo pelo hash do token recebido na URL. */
  async findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenRecord | null> {
    const row = await this.db.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      usedAt: row.usedAt,
      expiresAt: row.expiresAt,
    };
  }

  /** Marca token como usado e define `user.emailVerifiedAt` em transação. */
  async confirmEmailVerification(tokenId: string, userId: string): Promise<void> {
    await this.db.emailVerificationToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
    await this.db.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.db.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }
}

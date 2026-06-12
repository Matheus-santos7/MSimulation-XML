import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type {
  EmailVerificationRepository,
  EmailVerificationTokenRecord,
} from "../../domain/ports/email-verification.repository.js";

export class PrismaEmailVerificationRepository implements EmailVerificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async replacePendingToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: { userId, tokenHash, expiresAt },
      }),
    ]);
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenRecord | null> {
    const row = await this.prisma.emailVerificationToken.findUnique({
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

  async confirmEmailVerification(tokenId: string, userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: tokenId },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }
}

import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { clearedLockoutState } from "../../../../lib/auth/login-lockout.js";
import type {
  PasswordResetRepository,
  PasswordResetTokenRecord,
} from "../../domain/ports/password-reset.repository.js";
import { mapAuthUser } from "./user-prisma.mapper.js";

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async replacePendingToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt },
      }),
    ]);
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      usedAt: row.usedAt,
      expiresAt: row.expiresAt,
      user: mapAuthUser(row.user),
    };
  }

  async completePasswordReset(tokenId: string, userId: string, passwordHash: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: tokenId },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          password: passwordHash,
          ...clearedLockoutState(),
        },
      });
    });
  }
}

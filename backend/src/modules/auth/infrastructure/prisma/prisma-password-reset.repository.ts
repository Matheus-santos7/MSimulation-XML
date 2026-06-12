import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { clearedLockoutState } from "../../../../lib/auth/login-lockout.js";
import type {
  PasswordResetRepository,
  PasswordResetTokenRecord,
} from "../../domain/ports/password-reset.repository.js";
import { mapAuthUser } from "./user-prisma.mapper.js";

/**
 * Implementação Prisma de tokens de redefinição de senha.
 *
 * Mantém no máximo um token pendente por utilizador (invalida anteriores).
 */
export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Invalida tokens pendentes e cria novo token com hash e expiração.
   * O token em claro só viaja por e-mail, nunca é persistido.
   */
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

  /** Busca token pelo hash para validação em `ResetPasswordUseCase`. */
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

  /**
   * Marca token como usado, atualiza senha e limpa lockout em transação atómica.
   */
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

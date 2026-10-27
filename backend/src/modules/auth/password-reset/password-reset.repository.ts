import { Injectable } from "@nestjs/common";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { clearedLockoutState } from "../rules/login-lockout.rules.js";
import { mapAuthUser } from "../user/user.mapper.js";
import type { AuthUser } from "../user/user.types.js";

/**
 * Implementação Prisma de tokens de redefinição de senha.
 *
 * Mantém no máximo um token pendente por utilizador (invalida anteriores).
 */
export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  usedAt: Date | null;
  expiresAt: Date;
  user: AuthUser;
};

@Injectable()
export class PasswordResetRepository {
  private get db() {
    return getDbClient();
  }

  /**
   * Invalida tokens pendentes e cria novo token com hash e expiração.
   * O token em claro só viaja por e-mail, nunca é persistido.
   */
  async replacePendingToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.db.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  /** Busca token pelo hash para validação em `ResetPasswordUseCase`. */
  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const row = await this.db.passwordResetToken.findUnique({
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
  async completePasswordReset(
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.db.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
    await this.db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.db.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        ...clearedLockoutState(),
      },
    });
  }
}

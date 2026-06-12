import type { AuthUser } from "../entities/user.entity.js";

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  usedAt: Date | null;
  expiresAt: Date;
  user: AuthUser;
};

export interface PasswordResetRepository {
  replacePendingToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  completePasswordReset(tokenId: string, userId: string, passwordHash: string): Promise<void>;
}

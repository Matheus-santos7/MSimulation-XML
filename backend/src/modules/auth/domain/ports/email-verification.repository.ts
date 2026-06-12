export type EmailVerificationTokenRecord = {
  id: string;
  userId: string;
  usedAt: Date | null;
  expiresAt: Date;
};

export interface EmailVerificationRepository {
  replacePendingToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenRecord | null>;
  confirmEmailVerification(tokenId: string, userId: string): Promise<void>;
}

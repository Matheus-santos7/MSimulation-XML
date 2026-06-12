export type CreateUserSessionData = {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
};

export type ActiveUserSession = {
  id: string;
  userId: string;
};

export interface UserSessionRepository {
  createSession(data: CreateUserSessionData): Promise<void>;
  findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<ActiveUserSession | null>;
  revokeByRefreshTokenHash(refreshTokenHash: string): Promise<void>;
  revokeById(sessionId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

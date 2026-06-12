import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type {
  ActiveUserSession,
  CreateUserSessionData,
  UserSessionRepository,
} from "../../domain/ports/user-session.repository.js";

export class PrismaUserSessionRepository implements UserSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(data: CreateUserSessionData): Promise<void> {
    await this.prisma.userSession.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<ActiveUserSession | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash },
    });
    if (!session || session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    return { id: session.id, userId: session.userId };
  }

  async revokeByRefreshTokenHash(refreshTokenHash: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type {
  ActiveUserSession,
  CreateUserSessionData,
  UserSessionRepository,
} from "../../domain/ports/user-session.repository.js";

/**
 * Implementação Prisma do port {@link UserSessionRepository}.
 *
 * Gere refresh tokens opacos: hash SHA-256 persistido, revogação e expiração.
 */
export class PrismaUserSessionRepository implements UserSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Cria sessão com hash do refresh token (nunca persiste o token em claro). */
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

  /**
   * Localiza sessão ativa pelo hash do refresh token.
   * @returns `null` se revogada ou expirada
   */
  async findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<ActiveUserSession | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash },
    });
    if (!session || session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    return { id: session.id, userId: session.userId };
  }

  /** Revoga sessão específica (logout com refresh token). */
  async revokeByRefreshTokenHash(refreshTokenHash: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoga sessão por ID (rotação no refresh: sessão antiga invalidada). */
  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoga todas as sessões do utilizador (logout global, reset de senha). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

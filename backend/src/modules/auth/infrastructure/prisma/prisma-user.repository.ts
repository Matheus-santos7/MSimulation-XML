import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { clearedLockoutState } from "../../../../lib/auth/login-lockout.js";
import type { LoginLockoutState } from "../../domain/ports/login-lockout.port.js";
import type { AuthUser, AuthUserWithTenant } from "../../domain/entities/user.entity.js";
import type { CreateUserData, UserRepository } from "../../domain/ports/user.repository.js";
import { mapAuthUser, mapAuthUserWithTenant } from "./user-prisma.mapper.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<AuthUserWithTenant | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });
    return row ? mapAuthUserWithTenant(row) : null;
  }

  async findById(userId: string): Promise<AuthUserWithTenant | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    return row ? mapAuthUserWithTenant(row) : null;
  }

  async findAuthUserById(userId: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    return row ? mapAuthUser(row) : null;
  }

  async findTotpStatus(userId: string): Promise<{ totpEnabledAt: Date | null } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return row != null;
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    const row = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name ?? null,
        password: data.passwordHash,
        tenantId: undefined,
        role: "MEMBER",
        emailVerifiedAt: data.emailVerifiedAt,
      },
    });
    return mapAuthUser(row);
  }

  async updateLoginLockout(userId: string, state: LoginLockoutState): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: state,
    });
  }

  async clearLoginLockout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: clearedLockoutState(),
    });
  }

  async incrementTokenVersion(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async updatePasswordAndClearLockout(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        ...clearedLockoutState(),
      },
    });
  }

  async saveTotpSecret(userId: string, secretEnc: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: secretEnc },
    });
  }

  async enableTotp(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabledAt: new Date() },
    });
  }

  async disableTotp(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpEnabledAt: null,
      },
    });
  }
}

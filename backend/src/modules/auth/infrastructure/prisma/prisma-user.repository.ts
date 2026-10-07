import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { clearedLockoutState } from "../../domain/services/login-lockout.service.js";
import type { LoginLockoutState } from "../../domain/ports/login-lockout.port.js";
import type { AuthUser, AuthUserWithTenant } from "../../domain/entities/user.entity.js";
import type { CreateUserData, UserRepository } from "../../domain/ports/user.repository.js";
import { mapAuthUser, mapAuthUserWithTenant } from "./user-prisma.mapper.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";

/**
 * Implementação Prisma do port {@link UserRepository}.
 *
 * Centraliza leitura/escrita de `user`: credenciais, lockout, 2FA e `tokenVersion`.
 */
export class PrismaUserRepository implements UserRepository {
  private get db() {
    return getDbClient();
  }

  /** Busca utilizador por e-mail com tenant incluído (login e reset de senha). */
  async findByEmail(email: string): Promise<AuthUserWithTenant | null> {
    const row = await this.db.user.findUnique({
      where: { email },
      include: { tenant: true },
    });
    return row ? mapAuthUserWithTenant(row) : null;
  }

  /** Busca utilizador por ID com tenant (sessão, `/auth/me`). */
  async findById(userId: string): Promise<AuthUserWithTenant | null> {
    const row = await this.db.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    return row ? mapAuthUserWithTenant(row) : null;
  }

  /** Busca utilizador sem join de tenant (2FA, verificação de e-mail). */
  async findAuthUserById(userId: string): Promise<AuthUser | null> {
    const row = await this.db.user.findUnique({ where: { id: userId } });
    return row ? mapAuthUser(row) : null;
  }

  /** Retorna apenas se 2FA está ativo (endpoint `/auth/2fa/status`). */
  async findTotpStatus(userId: string): Promise<{ totpEnabledAt: Date | null } | null> {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    });
  }

  /** Verifica unicidade de e-mail antes do registo. */
  async existsByEmail(email: string): Promise<boolean> {
    const row = await this.db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return row != null;
  }

  /**
   * Cria conta nova sem tenant (`tenantId` nulo, role `MEMBER`).
   * @param data - E-mail, hash de senha e estado de verificação de e-mail
   */
  async createUser(data: CreateUserData): Promise<AuthUser> {
    const row = await this.db.user.create({
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

  /** Atualiza contador de falhas e data de bloqueio após credencial inválida. */
  async updateLoginLockout(userId: string, state: LoginLockoutState): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: state,
    });
  }

  /** Zera lockout após login ou 2FA bem-sucedido. */
  async clearLoginLockout(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: clearedLockoutState(),
    });
  }

  /**
   * Invalida todos os access tokens em circulação (logout global, reset de senha).
   * Access JWTs antigos falham na verificação de `tokenVersion`.
   */
  async incrementTokenVersion(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  /** Atualiza hash de senha e limpa lockout (uso legado; preferir password-reset repository). */
  async updatePasswordAndClearLockout(userId: string, passwordHash: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        ...clearedLockoutState(),
      },
    });
  }

  /** Persiste segredo TOTP encriptado durante setup (antes de ativar 2FA). */
  async saveTotpSecret(userId: string, secretEnc: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { totpSecretEnc: secretEnc },
    });
  }

  /** Marca 2FA como ativo (`totpEnabledAt`). */
  async enableTotp(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { totpEnabledAt: new Date() },
    });
  }

  /** Remove segredo e desativa 2FA. */
  async disableTotp(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpEnabledAt: null,
      },
    });
  }
}

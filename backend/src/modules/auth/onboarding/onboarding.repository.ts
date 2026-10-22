import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client.js";
import { isPrismaUniqueError } from "../../../lib/db/prisma-errors.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { TenantConflictError } from "../../org/index.js";
import { mapAuthUser } from "../user/user.mapper.js";
import type { AuthUser } from "../user/user.types.js";

export type TenantOnboardingData = Record<string, unknown>;

/**
 * Implementação Prisma do onboarding inicial (vínculo utilizador ↔ tenant).
 *
 * Cria `tenant` e atualiza `user.tenantId` + `role: ADMIN` atomicamente.
 */
@Injectable()
export class OnboardingRepository {
  private get db() {
    return getDbClient();
  }

  /** Carrega utilizador para validar estado antes do onboarding. */
  async findUserForOnboarding(userId: string): Promise<AuthUser | null> {
    const row = await this.db.user.findUnique({ where: { id: userId } });
    return row ? mapAuthUser(row) : null;
  }

  /**
   * Cria empresa e associa ao utilizador.
   * @throws {TenantConflictError} CNPJ duplicado
   */
  async createTenantAndAttachUser(userId: string, tenantData: TenantOnboardingData): Promise<void> {
    try {
      const tenantRow = await this.db.tenant.create({
        data: tenantData as Prisma.TenantCreateInput,
      });
      await this.db.user.update({
        where: { id: userId },
        data: { tenantId: tenantRow.id, role: "ADMIN" },
      });
    } catch (error) {
      if (error instanceof TenantConflictError) throw error;
      if (isPrismaUniqueError(error)) {
        throw new TenantConflictError("CNPJ já cadastrado");
      }
      throw error;
    }
  }
}

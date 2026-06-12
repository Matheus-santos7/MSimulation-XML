import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import { isPrismaUniqueError } from "../../../../lib/org/db-errors.js";
import { TenantConflictError } from "../../../org/index.js";
import type { AuthUser } from "../../domain/entities/user.entity.js";
import type { OnboardingRepository, TenantOnboardingData } from "../../domain/ports/onboarding.repository.js";
import { mapAuthUser } from "./user-prisma.mapper.js";

/**
 * Implementação Prisma do onboarding inicial (vínculo utilizador ↔ tenant).
 *
 * Cria `tenant` e atualiza `user.tenantId` + `role: ADMIN` atomicamente.
 */
export class PrismaOnboardingRepository implements OnboardingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Carrega utilizador para validar estado antes do onboarding. */
  async findUserForOnboarding(userId: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    return row ? mapAuthUser(row) : null;
  }

  /**
   * Cria empresa e associa ao utilizador.
   * @throws {TenantConflictError} CNPJ duplicado
   */
  async createTenantAndAttachUser(userId: string, tenantData: TenantOnboardingData): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const tenantRow = await tx.tenant.create({
          data: tenantData as Prisma.TenantCreateInput,
        });
        await tx.user.update({
          where: { id: userId },
          data: { tenantId: tenantRow.id, role: "ADMIN" },
        });
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

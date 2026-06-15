import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import { isPrismaUniqueError } from "../../../../lib/org/db-errors.js";
import {
  normalizeFiscalRoleIds,
  syncEmitenteFiscalFlags,
} from "../../../../lib/org/sync-emitente-fiscal-flags.js";
import { runInTransaction } from "../../../../lib/db/prisma-tx.js";
import type { Tenant } from "../../domain/entities/tenant.entity.js";
import { TenantConflictError } from "../../domain/errors/tenant-conflict.error.js";
import type {
  TenantFiscalRoles,
  TenantRepository,
  TenantWriteData,
} from "../../domain/ports/tenant.repository.js";
import { mapTenantFromPrisma } from "./tenant-prisma.mapper.js";
import { mapTenantFilialFromPrisma } from "./tenant-filial-prisma.mapper.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";

export class PrismaTenantRepository implements TenantRepository {
  private get db() {
    return getDbClient();
  }

  async list(): Promise<Tenant[]> {
    const rows = await this.db.tenant.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(mapTenantFromPrisma);
  }

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.db.tenant.findUnique({ where: { id } });
    return row ? mapTenantFromPrisma(row) : null;
  }

  async findByIdWithFiliais(id: string): Promise<Tenant | null> {
    const row = await this.db.tenant.findUnique({
      where: { id },
      include: { filiais: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) return null;
    const tenant = mapTenantFromPrisma(row);
    return {
      ...tenant,
      filiais: row.filiais.map(mapTenantFilialFromPrisma),
    };
  }

  async create(data: TenantWriteData): Promise<Tenant> {
    try {
      const row = await this.db.tenant.create({
        data: data as Prisma.TenantCreateInput,
      });
      return mapTenantFromPrisma(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new TenantConflictError("CNPJ já cadastrado");
      }
      throw error;
    }
  }

  async update(id: string, data: TenantWriteData): Promise<Tenant | null> {
    const existing = await this.db.tenant.findUnique({ where: { id } });
    if (!existing) return null;

    try {
      const row = await this.db.tenant.update({
        where: { id },
        data: data as Prisma.TenantUpdateInput,
      });
      return mapTenantFromPrisma(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new TenantConflictError("CNPJ já cadastrado");
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.db.tenant.findUnique({ where: { id } });
    if (!existing) return false;
    await this.db.tenant.delete({ where: { id } });
    return true;
  }

  async updateFiscalRoles(tenantId: string, roles: TenantFiscalRoles): Promise<Tenant> {
    const normalized = normalizeFiscalRoleIds(tenantId, roles);
    return runInTransaction(this.db, async (tx) => {
      await syncEmitenteFiscalFlags(tx, tenantId, normalized);
      const row = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          emitenteRemessaId: normalized.emitenteRemessaId,
          emitenteTransferenciaId: normalized.emitenteTransferenciaId,
        },
      });
      return mapTenantFromPrisma(row);
    });
  }
}

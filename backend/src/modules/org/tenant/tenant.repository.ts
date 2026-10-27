import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client.js";
import { isPrismaUniqueError } from "../../../lib/db/prisma-errors.js";
import { runInTransaction } from "../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import {
  normalizeFiscalRoleIds,
  syncEmitenteFiscalFlags,
} from "../emitente-fiscal/fiscal-roles.rules.js";
import { OrgError } from "../errors/org.errors.js";
import { mapTenantFilial } from "../filial/filial.mapper.js";
import { mapTenant } from "./tenant.mapper.js";
import type { Tenant, TenantFiscalRoles, TenantWriteData } from "./tenant.types.js";

@Injectable()
export class TenantRepository {
  private get db() {
    return getDbClient();
  }

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.db.tenant.findUnique({ where: { id } });
    return row ? mapTenant(row) : null;
  }

  async findByIdWithFiliais(id: string): Promise<Tenant | null> {
    const row = await this.db.tenant.findUnique({
      where: { id },
      include: { filiais: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) return null;
    const tenant = mapTenant(row);
    return {
      ...tenant,
      filiais: row.filiais.map(mapTenantFilial),
    };
  }

  async update(id: string, data: TenantWriteData): Promise<Tenant | null> {
    const existing = await this.db.tenant.findUnique({ where: { id } });
    if (!existing) return null;

    try {
      const row = await this.db.tenant.update({
        where: { id },
        data: data as Prisma.TenantUpdateInput,
      });
      return mapTenant(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new OrgError.TenantConflict("CNPJ já cadastrado");
      }
      throw error;
    }
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
      return mapTenant(row);
    });
  }
}

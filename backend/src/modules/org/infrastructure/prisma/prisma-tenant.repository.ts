import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { isPrismaUniqueError } from "../../../../lib/org/db-errors.js";
import type { Tenant } from "../../domain/entities/tenant.entity.js";
import { TenantConflictError } from "../../domain/errors/tenant-conflict.error.js";
import type { TenantRepository, TenantWriteData } from "../../domain/ports/tenant.repository.js";
import { mapTenantFromPrisma } from "./tenant-prisma.mapper.js";

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: DbClient) {}

  async list(): Promise<Tenant[]> {
    const rows = await this.prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(mapTenantFromPrisma);
  }

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({ where: { id } });
    return row ? mapTenantFromPrisma(row) : null;
  }

  async create(data: TenantWriteData): Promise<Tenant> {
    try {
      const row = await this.prisma.tenant.create({
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
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) return null;

    try {
      const row = await this.prisma.tenant.update({
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
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) return false;
    await this.prisma.tenant.delete({ where: { id } });
    return true;
  }
}

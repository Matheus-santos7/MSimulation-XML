import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client.js";
import { isPrismaUniqueError } from "../../../lib/db/prisma-errors.js";
import { runInTransaction } from "../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { syncEmitenteFiscalFlags } from "../emitente-fiscal/fiscal-roles.rules.js";
import { OrgError } from "../errors/org.errors.js";
import { mapTenantFilial } from "./filial.mapper.js";
import type { FilialWriteData, TenantFilial } from "./filial.types.js";

@Injectable()
export class FilialRepository {
  private get db() {
    return getDbClient();
  }

  async listByTenant(tenantId: string): Promise<TenantFilial[]> {
    const rows = await this.db.tenantFilial.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapTenantFilial);
  }

  async findById(tenantId: string, id: string): Promise<TenantFilial | null> {
    const row = await this.db.tenantFilial.findFirst({ where: { id, tenantId } });
    return row ? mapTenantFilial(row) : null;
  }

  async create(tenantId: string, data: FilialWriteData): Promise<TenantFilial> {
    try {
      const row = await this.db.tenantFilial.create({
        data: this.toCreateInput(tenantId, data),
      });
      return mapTenantFilial(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new OrgError.FilialInvalid("CNPJ já cadastrado para esta empresa");
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<FilialWriteData>,
  ): Promise<TenantFilial | null> {
    const existing = await this.db.tenantFilial.findFirst({ where: { id, tenantId } });
    if (!existing) return null;

    try {
      const row = await this.db.tenantFilial.update({
        where: { id },
        data: this.toUpdateInput(data),
      });
      return mapTenantFilial(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new OrgError.FilialInvalid("CNPJ já cadastrado para esta empresa");
      }
      throw error;
    }
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.db.tenantFilial.findFirst({ where: { id, tenantId } });
    if (!existing) return false;

    await runInTransaction(this.db, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (tenant) {
        const roles = {
          emitenteRemessaId: tenant.emitenteRemessaId === id ? null : tenant.emitenteRemessaId,
          emitenteTransferenciaId:
            tenant.emitenteTransferenciaId === id ? null : tenant.emitenteTransferenciaId,
        };
        await tx.tenant.update({
          where: { id: tenantId },
          data: roles,
        });
        await syncEmitenteFiscalFlags(tx, tenantId, roles);
      }
      await tx.tenantFilial.delete({ where: { id } });
    });

    return true;
  }

  private toCreateInput(tenantId: string, data: FilialWriteData): Prisma.TenantFilialCreateInput {
    return {
      tenant: { connect: { id: tenantId } },
      razaoSocial: data.razaoSocial,
      nomeFantasia: data.nomeFantasia,
      cnpj: data.cnpj.replace(/\D/g, ""),
      ie: data.ie,
      crt: data.crt,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      codigoMunicipio: data.codigoMunicipio,
      municipio: data.municipio,
      uf: data.uf.toUpperCase(),
      cep: data.cep.replace(/\D/g, ""),
      telefone: data.telefone,
      serieRemessa: data.serieRemessa,
      serieTransferencia: data.serieTransferencia,
      ...(data.unidadeLogisticaPadraoId
        ? { unidadeLogisticaPadrao: { connect: { id: data.unidadeLogisticaPadraoId } } }
        : {}),
    };
  }

  private toUpdateInput(data: Partial<FilialWriteData>): Prisma.TenantFilialUpdateInput {
    return {
      ...(data.razaoSocial != null ? { razaoSocial: data.razaoSocial } : {}),
      ...(data.nomeFantasia != null ? { nomeFantasia: data.nomeFantasia } : {}),
      ...(data.cnpj != null ? { cnpj: data.cnpj.replace(/\D/g, "") } : {}),
      ...(data.ie != null ? { ie: data.ie } : {}),
      ...(data.crt != null ? { crt: data.crt } : {}),
      ...(data.logradouro != null ? { logradouro: data.logradouro } : {}),
      ...(data.numero != null ? { numero: data.numero } : {}),
      ...(data.complemento !== undefined ? { complemento: data.complemento } : {}),
      ...(data.bairro != null ? { bairro: data.bairro } : {}),
      ...(data.codigoMunicipio != null ? { codigoMunicipio: data.codigoMunicipio } : {}),
      ...(data.municipio != null ? { municipio: data.municipio } : {}),
      ...(data.uf != null ? { uf: data.uf.toUpperCase() } : {}),
      ...(data.cep != null ? { cep: data.cep.replace(/\D/g, "") } : {}),
      ...(data.telefone !== undefined ? { telefone: data.telefone } : {}),
      ...(data.serieRemessa != null ? { serieRemessa: data.serieRemessa } : {}),
      ...(data.serieTransferencia !== undefined
        ? { serieTransferencia: data.serieTransferencia }
        : {}),
      ...(data.unidadeLogisticaPadraoId !== undefined
        ? data.unidadeLogisticaPadraoId
          ? { unidadeLogisticaPadrao: { connect: { id: data.unidadeLogisticaPadraoId } } }
          : { unidadeLogisticaPadrao: { disconnect: true } }
        : {}),
    };
  }
}

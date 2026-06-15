import type { TenantFilial as PrismaTenantFilial } from "../../../../generated/prisma/client.js";
import type { TenantFilial } from "../../domain/entities/tenant-filial.entity.js";

export function mapTenantFilialFromPrisma(row: PrismaTenantFilial): TenantFilial {
  return {
    id: row.id,
    tenantId: row.tenantId,
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
    cnpj: row.cnpj,
    ie: row.ie,
    crt: row.crt,
    logradouro: row.logradouro,
    numero: row.numero,
    complemento: row.complemento ?? undefined,
    bairro: row.bairro,
    codigoMunicipio: row.codigoMunicipio,
    municipio: row.municipio,
    uf: row.uf,
    cep: row.cep,
    telefone: row.telefone ?? undefined,
    serieRemessa: row.serieRemessa,
    serieTransferencia: row.serieTransferencia ?? undefined,
    unidadeLogisticaPadraoId: row.unidadeLogisticaPadraoId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

import type { EnvironmentKind, Tenant as PrismaTenant } from "../../../../generated/prisma/client.js";
import type { Tenant } from "../../domain/entities/tenant.entity.js";

export function mapTenant(row: PrismaTenant): Tenant {
  return {
    id: row.id,
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
    cnpj: row.cnpj,
    ie: row.ie,
    iest: row.iest ?? undefined,
    crt: row.crt,
    logradouro: row.logradouro,
    numero: row.numero,
    complemento: row.complemento ?? undefined,
    bairro: row.bairro,
    codigoMunicipio: row.codigoMunicipio,
    municipio: row.municipio,
    uf: row.uf,
    cep: row.cep,
    codigoPais: row.codigoPais,
    nomePais: row.nomePais,
    telefone: row.telefone ?? undefined,
    ambiente: row.ambiente as EnvironmentKind,
    emitenteFiscalPrincipal: row.emitenteFiscalPrincipal,
    emitenteFiscalMatriz: row.emitenteFiscalMatriz,
    emitenteRemessaId: row.emitenteRemessaId ?? null,
    emitenteTransferenciaId: row.emitenteTransferenciaId ?? null,
  };
}

export function mapTenantFromPrisma(row: PrismaTenant): Tenant {
  return mapTenant(row);
}

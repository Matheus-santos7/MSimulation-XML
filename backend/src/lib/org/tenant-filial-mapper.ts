import type { TenantFilial } from "../../generated/prisma/client.js";

export function mapTenantFilial(row: TenantFilial) {
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
    emitenteFiscalPrincipal: row.emitenteFiscalPrincipal,
    emitenteFiscalMatriz: row.emitenteFiscalMatriz,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Formato `<emit>` para remessa emitida pela filial. */
export function mapEmitenteFromFilial(filial: TenantFilial) {
  return {
    cnpj: filial.cnpj.replace(/\D/g, ""),
    xNome: filial.razaoSocial,
    xFant: filial.nomeFantasia,
    ie: filial.ie.replace(/\D/g, ""),
    crt: filial.crt,
    uf: filial.uf.toUpperCase(),
    endereco: {
      xLgr: filial.logradouro,
      nro: filial.numero,
      xCpl: filial.complemento ?? undefined,
      xBairro: filial.bairro,
      cMun: filial.codigoMunicipio,
      xMun: filial.municipio,
      uf: filial.uf.toUpperCase(),
      cep: filial.cep.replace(/\D/g, ""),
      cPais: 1058,
      xPais: "Brasil",
      fone: filial.telefone?.replace(/\D/g, "") ?? undefined,
    },
  };
}

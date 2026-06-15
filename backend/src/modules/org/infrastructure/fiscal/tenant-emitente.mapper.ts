import type { Tenant, TenantFilial } from "../../../../generated/prisma/client.js";

/** Formato para geração de XML NF-e (`<emit>`) a partir do tenant. */
export function mapEmitente(row: Tenant) {
  return {
    cnpj: row.cnpj,
    xNome: row.razaoSocial,
    xFant: row.nomeFantasia,
    ie: row.ie,
    iest: row.iest ?? undefined,
    crt: row.crt,
    uf: row.uf,
    endereco: {
      xLgr: row.logradouro,
      nro: row.numero,
      xCpl: row.complemento ?? undefined,
      xBairro: row.bairro,
      cMun: row.codigoMunicipio,
      xMun: row.municipio,
      uf: row.uf,
      cep: row.cep,
      cPais: row.codigoPais,
      xPais: row.nomePais,
      fone: row.telefone ?? undefined,
    },
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

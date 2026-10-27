import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import { unidadeParaDestinoFiscal } from "./rules/destino-fiscal.js";
import type { LogisticsUnit } from "./logistics-unit.types.js";

export type UnidadeLogisticaRow = {
  id: string;
  marketplace: MarketplaceCode;
  codigo: string;
  nome: string;
  destNomeFiscal: string;
  cnpj: string;
  ie: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoMunicipio: string;
  codigoPais: number;
  nomePais: string;
  indIeDest: number;
  idCadIntTran: string | null;
  ativa: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function mapLogisticsUnitFromPrisma(
  row: UnidadeLogisticaRow,
  tenantId: string,
  opts?: { padrao?: boolean },
): LogisticsUnit {
  return {
    id: row.id,
    tenantId,
    marketplace: row.marketplace,
    codigo: row.codigo,
    nome: row.nome,
    destNomeFiscal: row.destNomeFiscal,
    cnpj: row.cnpj,
    ie: row.ie ?? undefined,
    idCadIntTran: row.idCadIntTran ?? undefined,
    endereco: {
      logradouro: row.logradouro,
      numero: row.numero,
      complemento: row.complemento ?? undefined,
      bairro: row.bairro,
      municipio: row.municipio,
      uf: row.uf,
      cep: row.cep,
      codigoMunicipio: row.codigoMunicipio,
    },
    destinatarioFiscal: unidadeParaDestinoFiscal(row),
    ativa: row.ativa,
    padrao: opts?.padrao ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

import { unidadeParaDestinoFiscal } from "../../../../lib/logistics/meli-unidade.js";
import type { LogisticsUnit } from "../../domain/entities/logistics-unit.entity.js";

export type MeliUnidadeLogisticaRow = {
  id: string;
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
  row: MeliUnidadeLogisticaRow,
  tenantId: string,
  opts?: { padrao?: boolean },
): LogisticsUnit {
  return {
    id: row.id,
    tenantId,
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

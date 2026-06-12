/**
 * Destinatário fiscal derivado da unidade ML (NF-e de remessa / avanço).
 * Inclui `indIeDest` exigido pelo layout da NF-e.
 */
export type LogisticsUnitFiscalDestination = {
  nome: string;
  cnpj: string;
  ie: string | null;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoPais: number;
  nomePais: string;
  indIeDest: number;
};

/** Endereço operacional do centro de distribuição (CD). */
export type LogisticsUnitAddress = {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoMunicipio: string;
};

/**
 * Unidade Logística (Logistics Unit) — centro de distribuição Mercado Livre Full.
 *
 * Catálogo global `meli_unidade_logistica` vinculado ao tenant via `tenant_unidade_logistica`.
 * A unidade **padrão** (`padrao`) é usada como destino de remessa quando o utilizador
 * não seleciona CD explicitamente.
 *
 * `idCadIntTran` identifica o CD no cadastro de integração ML (CT-e / transporte).
 */
export type LogisticsUnit = {
  id: string;
  tenantId: string;
  codigo: string;
  nome: string;
  destNomeFiscal: string;
  cnpj: string;
  ie?: string;
  idCadIntTran?: string;
  endereco: LogisticsUnitAddress;
  destinatarioFiscal: LogisticsUnitFiscalDestination;
  ativa: boolean;
  padrao: boolean;
  createdAt: string;
  updatedAt: string;
};

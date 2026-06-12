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

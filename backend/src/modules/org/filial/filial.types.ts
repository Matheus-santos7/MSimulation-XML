/**
 * Filial vinculada à matriz (tenant) — estabelecimento com CNPJ próprio.
 */
export type TenantFilial = {
  id: string;
  tenantId: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  crt: number;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string;
  serieRemessa: number;
  serieTransferencia?: number;
  unidadeLogisticaPadraoId?: string;
  createdAt: string;
  updatedAt: string;
};

/** Dados gravados da filial (CNPJ e CEP normalizados pelo repository). */
export type FilialWriteData = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  crt: number;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string | null;
  serieRemessa: number;
  serieTransferencia?: number | null;
  unidadeLogisticaPadraoId?: string | null;
};

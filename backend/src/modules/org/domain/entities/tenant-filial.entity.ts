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

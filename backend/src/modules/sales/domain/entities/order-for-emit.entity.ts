export type OrderProductForEmit = {
  id: string;
  ncm: string;
  preco: { toString(): string };
  precoCusto: { toString(): string };
  taxRuleBaseId: string | null;
  nome?: string;
  sku?: string;
  ean?: string | null;
  cest?: string;
  exTipi?: string | null;
  unidade?: string;
  origem?: number;
};

export type TenantForSalesEmit = {
  id: string;
  uf: string;
  cnpj: string;
  serieRemessa: number;
  serieCte: number;
};

/** Minimum order data to emit return + sale + CT-e chain. */
export type OrderForEmit = {
  tenantId: string;
  productId: string;
  quantidade: number;
  destCpf: string;
  destNome: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destUf: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destTelefone: string | null;
  destIndIeDest: number;
  product: OrderProductForEmit;
  tenant: TenantForSalesEmit;
};

/** Produto com campos fiscais necessários para a Sales Chain. */
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

/** Tenant reduzido para emissão (séries e identificação fiscal). */
export type TenantForSalesEmit = {
  id: string;
  uf: string;
  cnpj: string;
  serieRemessa: number;
  serieCte: number;
};

/**
 * Snapshot mínimo de um pedido (ou checkout) para emitir a cadeia fiscal completa.
 *
 * Contém destinatário final (comprador), produto, tenant e quantidade.
 * Usado por `SalesChainOrchestrator` — não depende de registo prévio em `pedido`.
 */
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

import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";

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
  cest?: string | null;
  exTipi?: string | null;
  unidade?: string;
  origem?: number;
  nfci?: string | null;
  /** Produto sujeito a ICMS-ST (CFOP 5405/6403/6404 com estoque próprio). */
  sujeitoSt?: boolean;
};

/** Tenant reduzido para emissão (séries e identificação fiscal). */
export type TenantForSalesEmit = {
  id: string;
  uf: string;
  cnpj: string;
  serieRemessa: number;
  serieCte: number;
};

/** Linha de produto no snapshot de emissão. */
export type OrderItemForEmit = {
  productId: string;
  quantidade: number;
  product: OrderProductForEmit;
  valorDesconto?: number;
  /** Id do pedido no marketplace por produto → `<xPed>` no `nItem`. */
  xPed?: string;
};

/**
 * Snapshot mínimo de um pedido (ou checkout) para emitir a cadeia fiscal completa.
 *
 * Contém destinatário final (comprador), itens, tenant e quantidades por linha.
 * Fretes são do pedido como um todo (`valorFreteConsumidor` / `valorFreteSeller` no root).
 * Usado pelo `SalesChainEmitter` — não depende de registo prévio em `pedido`.
 */
export type OrderForEmit = {
  tenantId: string;
  /** Marketplace que fatura: perfil fiscal, configuração do faturador e estoque FIFO. */
  marketplace: MarketplaceCode;
  items: OrderItemForEmit[];
  /** Order consumer freight for NF-e. */
  valorFreteConsumidor?: number;
  /** Order seller freight for CT-e. */
  valorFreteSeller?: number;
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
  destIe?: string | null;
  tenant: TenantForSalesEmit;
  /** Id do pedido no marketplace (`idPedidoCanal` / `xPed`). */
  marketplaceOrderId?: string;
};

import type { Buyer } from "./buyer.entity.js";

/** Resumo do produto exibido na listagem/detalhe do pedido. */
export type OrderProductSummary = {
  id: string;
  sku: string;
  nome: string;
  preco: number;
};

/** NF-e de venda vinculada ao pedido após faturamento. */
export type OrderNfeSummary = {
  chave: string;
  numero: number;
  serie: number;
  status: string;
};

/**
 * Pedido de venda persistido (`pedido` no Prisma).
 *
 * Status típicos: `RASCUNHO` (editável) e `FATURADO` (bloqueado).
 * `editavel` / `excluivel` são flags de UI derivadas do status.
 */
export type Order = {
  id: string;
  tenantId: string;
  status: string;
  pedidoMl?: string;
  productId: string;
  quantidade: number;
  product: OrderProductSummary;
  comprador: Buyer;
  valorTotal: number;
  nfe?: OrderNfeSummary;
  createdAt: string;
  updatedAt: string;
  editavel: boolean;
  excluivel: boolean;
};

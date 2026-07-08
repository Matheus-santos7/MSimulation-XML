import type { Buyer } from "./buyer.entity.js";

/** Summary of a product used inside an order item. */
export type OrderProductSummary = {
  id: string;
  sku: string;
  nome: string;
  preco: number;
};

/** Single line item of an order (one product). */
export type OrderItemSummary = {
  id: string;
  productId: string;
  quantidade: number;
  desconto: number;
  frete: number;
  product: OrderProductSummary;
  /** Total value of this line (unit price * qty + frete - desconto). */
  valorTotalLinha: number;
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
 *
 * Mesmo com o modelo atual de banco (um produto por pedido),
 * a entidade expõe um array de itens para facilitar a evolução
 * para multi-produto sem quebrar o contrato externo.
 */
export type Order = {
  id: string;
  tenantId: string;
  status: string;
  pedidoMl?: string;
  /** Flat list of order items (at least one). */
  items: OrderItemSummary[];
  comprador: Buyer;
  /** Total value of the order (sum of line totals). */
  valorTotal: number;
  nfe?: OrderNfeSummary;
  createdAt: string;
  updatedAt: string;
  editavel: boolean;
  excluivel: boolean;
};

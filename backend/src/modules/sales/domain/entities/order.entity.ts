import type { Buyer } from "./buyer.entity.js";

export type OrderProductSummary = {
  id: string;
  sku: string;
  nome: string;
  preco: number;
};

export type OrderNfeSummary = {
  chave: string;
  numero: number;
  serie: number;
  status: string;
};

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

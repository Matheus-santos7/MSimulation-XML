import { lineTotal } from "@msimulation-xml/fiscal-core";
import type {
  OrderForEmit,
  OrderItemForEmit,
} from "../entities/order-for-emit.entity.js";
import { SalesChainError } from "../errors/sales-chain.error.js";

/**
 * Returns the first line item or throws when the order has no products.
 */
export function requirePrimaryOrderItem(order: OrderForEmit): OrderItemForEmit {
  const item = order.items[0];
  if (!item) {
    throw new SalesChainError("Pedido deve conter ao menos um item");
  }
  return item;
}

/**
 * Builds a single-item snapshot used by legacy emission steps (FIFO / retorno).
 */
export function sliceOrderForEmitItem(
  order: OrderForEmit,
  item: OrderItemForEmit,
): OrderForEmit {
  return {
    ...order,
    items: [item],
  };
}

/**
 * Sums sale and cost totals across all order lines (rounded per line).
 */
export function sumOrderEmitTotals(order: OrderForEmit): {
  valorTotalVenda: number;
  valorTotalCusto: number;
} {
  let valorTotalVenda = 0;
  let valorTotalCusto = 0;

  for (const item of order.items) {
    const unitSalePrice = Number(item.product.preco);
    const unitCostPrice = Number(item.product.precoCusto);
    const frete = item.valorFrete ?? 0;
    const desconto = item.valorDesconto ?? 0;
    const lineSale = lineTotal(unitSalePrice, item.quantidade) + frete - desconto;
    const lineCost = lineTotal(unitCostPrice, item.quantidade);

    valorTotalVenda += lineSale;
    valorTotalCusto += lineCost;
  }

  return {
    valorTotalVenda: Math.round(valorTotalVenda * 100) / 100,
    valorTotalCusto: Math.round(valorTotalCusto * 100) / 100,
  };
}

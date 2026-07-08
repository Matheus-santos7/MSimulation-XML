import type { PedidoItemRow } from "./order-prisma.mapper.js";
import { num } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import type { OrderItemSummary } from "../../domain/entities/order.entity.js";

export function mapOrderItemFromRow(row: PedidoItemRow): OrderItemSummary {
  const unitPrice = num(row.product.preco);
  const desconto = num(row.desconto);
  const valorTotalLinha =
    Math.round((unitPrice * row.quantidade - desconto) * 100) / 100;

  return {
    id: row.id,
    productId: row.productId,
    quantidade: row.quantidade,
    desconto,
    product: {
      id: row.product.id,
      sku: row.product.sku,
      nome: row.product.nome,
      preco: unitPrice,
    },
    valorTotalLinha,
  };
}

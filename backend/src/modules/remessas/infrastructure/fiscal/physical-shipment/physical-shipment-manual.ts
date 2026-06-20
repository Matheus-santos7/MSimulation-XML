/**
 * Manual shipment emission entry point (from UI/dedicated module).
 *
 * Loads tenant and products; does not modify product inventory stock.
 */
import type { DbClient } from "../../../../../lib/db/prisma-tx.js";
import { findProductInTenant } from "../../../../logistics/index.js";
import { realignRemessaFifoProductIdsBySku } from "../../fifo/remessa-fifo.js";
import { ShipmentError } from "./physical-shipment.errors.js";
import type {
  ManualShipmentItemInput,
  PhysicalShipmentLineInput,
} from "./physical-shipment.types.js";
import { emitShipmentNfeWithItems } from "./physical-shipment-core.js";

/**
 * Emits a manual physical shipment NF-e from the dedicated remessas UI module.
 *
 * Entry point: POST /movimentacoes/remessa
 */
export async function emitManualShipment(
  db: DbClient,
  input: {
    tenantId: string;
    unidadeDestinoId: string;
    items: ManualShipmentItemInput[];
  },
) {
  if (input.items.length === 0) {
    throw new ShipmentError("Informe ao menos um produto na remessa");
  }

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });

  const linhas: PhysicalShipmentLineInput[] = [];
  for (const [index, item] of input.items.entries()) {
    const product = await findProductInTenant(db, input.tenantId, {
      productId: item.productId,
      sku: item.productSku,
    });
    if (!product) {
      const skuHint = item.productSku?.trim() ? ` (SKU ${item.productSku.trim()})` : "";
      throw new ShipmentError(
        `Produto não encontrado (linha ${index + 1})${skuHint}. Confira o cadastro em Produtos.`,
      );
    }
    await realignRemessaFifoProductIdsBySku(db, input.tenantId, product.sku);
    if (item.quantidade < 1) {
      throw new ShipmentError(`Quantidade inválida na linha ${index + 1}`);
    }
    linhas.push({ product, quantidade: item.quantidade });
  }

  return emitShipmentNfeWithItems(db, tenant, linhas, {
    unidadeDestinoId: input.unidadeDestinoId,
  });
}

import { Injectable } from "@nestjs/common";
import { runInTransaction } from "../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { CheckoutError } from "../errors/sales.errors.js";
import type { OrderForEmit } from "../invoicing/types/order-for-emit.types.js";
import {
  buyerToDestColumns,
  itemDiscountColumn,
  mapOrderForEmitFromPrisma,
  mapOrderFromPrisma,
  orderFreightColumns,
} from "./order.mapper.js";
import type { Order } from "./order.types.js";
import type { OrderDraftData } from "./types/order-draft.types.js";

const pedidoItemInclude = {
  product: true,
} as const;

const orderInclude = {
  itens: {
    include: pedidoItemInclude,
    orderBy: { numeroItem: "asc" as const },
  },
  nfe: { select: { chave: true, numero: true, serie: true, status: true } },
} as const;

const PRODUCT_NOT_FOUND = "Produto não encontrado nesta empresa";

function itemRows(data: OrderDraftData) {
  return data.items.map((item, index) => ({
    productId: item.productId,
    numeroItem: index + 1,
    quantidade: item.quantidade,
    xPed: item.xPed,
    ...itemDiscountColumn(item),
  }));
}

/** Pedidos (`pedidos`) e linhas (`pedido_itens`) do tenant. */
@Injectable()
export class OrderRepository {
  private get db() {
    return getDbClient();
  }

  /** Pedidos do tenant com itens e NF-e vinculada (quando faturado). */
  async listByTenant(tenantId: string): Promise<Order[]> {
    const rows = await this.db.pedido.findMany({
      where: { tenantId },
      include: orderInclude,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    return rows.map(mapOrderFromPrisma);
  }

  async findById(tenantId: string, id: string): Promise<Order | null> {
    const row = await this.db.pedido.findFirst({
      where: { id, tenantId },
      include: orderInclude,
    });

    return row ? mapOrderFromPrisma(row) : null;
  }

  /** Snapshot completo para emitir a cadeia de venda (itens + tenant + destinatário). */
  async findForEmit(tenantId: string, id: string): Promise<OrderForEmit | null> {
    const row = await this.db.pedido.findFirst({
      where: { id, tenantId },
      include: {
        itens: { include: pedidoItemInclude, orderBy: { numeroItem: "asc" } },
        tenant: true,
      },
    });

    return row ? mapOrderForEmitFromPrisma(row) : null;
  }

  /** Estado do pedido, para checar bloqueio antes de editar. */
  findStatus(tenantId: string, id: string) {
    return this.db.pedido.findFirst({
      where: { id, tenantId },
      select: { status: true, marketplaceOrderId: true },
    });
  }

  async createDraft(tenantId: string, data: OrderDraftData): Promise<Order> {
    const row = await this.db.pedido.create({
      data: {
        tenantId,
        status: "RASCUNHO",
        marketplace: data.marketplace,
        marketplaceOrderId: data.marketplaceOrderId,
        ...buyerToDestColumns(data.comprador),
        ...orderFreightColumns(data),
        itens: { create: itemRows(data) },
      },
      include: orderInclude,
    });

    return mapOrderFromPrisma(row);
  }

  /** Troca os itens e os dados do rascunho numa transação. */
  async updateDraft(id: string, data: OrderDraftData): Promise<Order> {
    const row = await runInTransaction(this.db, async (tx) => {
      await tx.pedidoItem.deleteMany({ where: { pedidoId: id } });

      return tx.pedido.update({
        where: { id },
        data: {
          marketplace: data.marketplace,
          marketplaceOrderId: data.marketplaceOrderId,
          ...buyerToDestColumns(data.comprador),
          ...orderFreightColumns(data),
          itens: { create: itemRows(data) },
        },
        include: orderInclude,
      });
    });

    return mapOrderFromPrisma(row);
  }

  /** Marca como `FATURADO` e associa a NF-e de venda e o id do pedido no marketplace. */
  async markInvoiced(id: string, marketplaceOrderId: string, nfeId: string): Promise<Order> {
    const row = await this.db.pedido.update({
      where: { id },
      data: { status: "FATURADO", marketplaceOrderId, nfeId },
      include: orderInclude,
    });

    return mapOrderFromPrisma(row);
  }

  /** `false` quando o pedido não existe no tenant. */
  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.db.pedido.findFirst({ where: { id, tenantId } });
    if (!existing) return false;

    await this.db.pedido.delete({ where: { id } });

    return true;
  }

  /** @throws {CheckoutError} Algum produto não existe nesta empresa */
  async assertProductsBelongToTenant(tenantId: string, productIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(productIds)];
    const count = await this.db.product.count({ where: { tenantId, id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) throw new CheckoutError(PRODUCT_NOT_FOUND);
  }

  /**
   * Produtos e tenant para o checkout direto (sem rascunho).
   * @throws {CheckoutError} Algum produto não existe nesta empresa
   */
  async loadCheckoutContext(tenantId: string, productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];
    const products = await this.db.product.findMany({
      where: { tenantId, id: { in: uniqueIds } },
    });
    if (products.length !== uniqueIds.length) throw new CheckoutError(PRODUCT_NOT_FOUND);

    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const productById = new Map(products.map((product) => [product.id, product]));

    return {
      products: uniqueIds.map((id) => productById.get(id)!),
      tenant,
    };
  }
}

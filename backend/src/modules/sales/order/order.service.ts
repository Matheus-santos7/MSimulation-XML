import { Inject, Injectable } from "@nestjs/common";
import { OrderLockedError } from "../errors/sales.errors.js";
import type { OrderForEmit } from "../invoicing/types/order-for-emit.types.js";
import { OrderRepository } from "./order.repository.js";
import type { Order } from "./order.types.js";
import {
  resolveMarketplaceOrderId,
  withMarketplaceItemOrderIds,
} from "./rules/marketplace-order-id.js";
import { assertOrderFreightFilled } from "./rules/order-freight.validation.js";
import type { OrderDraftData } from "./types/order-draft.types.js";
import type { OrderCheckoutInput } from "./types/order-checkout-input.types.js";

/**
 * Pedidos de venda em rascunho: o marketplace é escolhido na criação e o id do pedido segue
 * o formato do perfil dele. Faturar fica no `invoicing/`.
 */
@Injectable()
export class OrderService {
  constructor(@Inject(OrderRepository) private readonly repository: OrderRepository) {}

  list(tenantId: string): Promise<Order[]> {
    return this.repository.listByTenant(tenantId);
  }

  get(tenantId: string, id: string): Promise<Order | null> {
    return this.repository.findById(tenantId, id);
  }

  findForEmit(tenantId: string, id: string): Promise<OrderForEmit | null> {
    return this.repository.findForEmit(tenantId, id);
  }

  markInvoiced(id: string, marketplaceOrderId: string, nfeId: string): Promise<Order> {
    return this.repository.markInvoiced(id, marketplaceOrderId, nfeId);
  }

  /** @throws {CheckoutError} Produto de outra empresa, frete vazio ou id fora do formato */
  async createDraft(tenantId: string, input: OrderCheckoutInput): Promise<Order> {
    const data = await this.toDraftData(tenantId, input);

    return this.repository.createDraft(tenantId, data);
  }

  /**
   * `null` quando o pedido não existe. Sem id novo, mantém o que o pedido já tinha.
   * @throws {OrderLockedError} Pedido já faturado
   */
  async updateDraft(
    id: string,
    tenantId: string,
    input: OrderCheckoutInput,
  ): Promise<Order | null> {
    const existing = await this.repository.findStatus(tenantId, id);
    if (!existing) return null;
    if (existing.status === "FATURADO") throw new OrderLockedError();

    const data = await this.toDraftData(tenantId, {
      ...input,
      pedidoMl: input.pedidoMl ?? existing.marketplaceOrderId ?? undefined,
    });

    return this.repository.updateDraft(id, data);
  }

  remove(tenantId: string, id: string): Promise<boolean> {
    return this.repository.delete(id, tenantId);
  }

  private async toDraftData(tenantId: string, input: OrderCheckoutInput): Promise<OrderDraftData> {
    assertOrderFreightFilled(input);
    await this.repository.assertProductsBelongToTenant(
      tenantId,
      input.items.map((item) => item.productId),
    );
    const { pedidoMl, items, ...rest } = input;

    return {
      ...rest,
      marketplaceOrderId: resolveMarketplaceOrderId(input.marketplace, pedidoMl),
      items: withMarketplaceItemOrderIds(input.marketplace, items),
    };
  }
}

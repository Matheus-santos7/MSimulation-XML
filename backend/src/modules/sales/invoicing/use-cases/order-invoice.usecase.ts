import { Inject, Injectable } from "@nestjs/common";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { OrderLockedError } from "../../errors/sales.errors.js";
import { OrderService } from "../../order/order.service.js";
import { SalesChainEmitter } from "../sales-chain/sales-chain.emitter.js";

/**
 * Fatura um rascunho no marketplace escolhido na criação: emite a cadeia de venda e marca o
 * pedido como `FATURADO`, vinculado à NF-e de venda.
 */
@Injectable()
export class OrderInvoiceUseCase {
  constructor(
    @Inject(OrderService) private readonly orders: OrderService,
    @Inject(SalesChainEmitter) private readonly salesChain: SalesChainEmitter,
  ) {}

  /**
   * `null` quando o pedido não existe no tenant.
   * @throws {OrderLockedError} Pedido já faturado
   * @throws {MarketplaceNotConfiguredError} Marketplace ainda sem perfil fiscal (422)
   */
  async execute(tenantId: string, id: string) {
    const existing = await this.orders.get(tenantId, id);
    if (!existing) return null;
    if (existing.status === "FATURADO") throw new OrderLockedError();

    const order = await this.orders.findForEmit(tenantId, id);
    if (!order) return null;

    const { venda: nfe } = await this.salesChain.emit(getDbClient(), order);
    const sale = nfe as { id: string; pedidoML?: string };
    const pedido = await this.orders.markInvoiced(
      id,
      sale.pedidoML ?? order.marketplaceOrderId ?? "",
      sale.id,
    );

    return { pedido, nfe };
  }
}

import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { OrderLockedError } from "../../domain/errors/order-locked.error.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";

export class InvoiceOrderUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly orderRepository: OrderRepository,
    private readonly salesChain: SalesChainPort,
  ) {}

  async execute(tenantId: string, id: string) {
    const order = await this.orderRepository.findForEmit(tenantId, id);
    if (!order) return null;

    const existing = await this.orderRepository.findById(tenantId, id);
    if (existing?.status === "FATURADO") throw new OrderLockedError();

    const { venda: nfe } = await this.salesChain.emit(this.prisma, order);
    const sale = nfe as { id: string; pedidoML?: string; pedidoMl?: string };
    const pedido = await this.orderRepository.markInvoiced(
      id,
      sale.pedidoML ?? sale.pedidoMl ?? "",
      sale.id,
    );

    return { pedido, nfe };
  }
}

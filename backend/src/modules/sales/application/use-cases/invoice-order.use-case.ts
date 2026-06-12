import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { OrderLockedError } from "../../domain/errors/order-locked.error.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";

/**
 * Fatura um pedido em rascunho: emite a Sales Chain e marca o pedido como `FATURADO`.
 *
 * Após sucesso, o pedido fica bloqueado para edição e referencia a NF-e de venda emitida.
 *
 * @param tenantId - Tenant emitente
 * @param id - UUID do pedido em `RASCUNHO`
 * @returns `{ pedido, nfe }` ou `null` se pedido não existir
 * @throws {OrderLockedError} Pedido já faturado
 * @throws {SalesChainError} Falha na cadeia fiscal
 * @throws {SaldoRemessaInsuficienteError} FIFO sem saldo
 */
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

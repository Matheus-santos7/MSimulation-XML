import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";

/**
 * Cria um pedido em status `RASCUNHO` sem emitir documentos fiscais.
 *
 * Valida que o produto pertence ao tenant antes de persistir.
 *
 * @param tenantId - Tenant emitente
 * @param input - Produto, quantidade e dados do comprador
 * @returns Pedido criado
 * @throws {CheckoutError} Produto inexistente ou de outro tenant
 */
export class CreateOrderDraftUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(tenantId: string, input: OrderCheckoutInput) {
    return this.orderRepository.createDraft(tenantId, input);
  }
}

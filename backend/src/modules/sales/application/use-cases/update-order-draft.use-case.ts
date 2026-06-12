import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";

/**
 * Atualiza um pedido em rascunho (produto, quantidade, comprador).
 *
 * @param id - UUID do pedido
 * @param tenantId - Tenant emitente
 * @param input - Novos dados do checkout
 * @returns Pedido atualizado ou `null` se não encontrado
 * @throws {OrderLockedError} Pedido já faturado (`FATURADO`)
 * @throws {CheckoutError} Produto inválido
 */
export class UpdateOrderDraftUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(id: string, tenantId: string, input: OrderCheckoutInput) {
    return this.orderRepository.updateDraft(id, tenantId, input);
  }
}

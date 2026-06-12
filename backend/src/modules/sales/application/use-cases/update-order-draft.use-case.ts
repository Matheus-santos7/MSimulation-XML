import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";

export class UpdateOrderDraftUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(id: string, tenantId: string, input: OrderCheckoutInput) {
    return this.orderRepository.updateDraft(id, tenantId, input);
  }
}

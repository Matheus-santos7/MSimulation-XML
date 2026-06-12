import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";

export class CreateOrderDraftUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(tenantId: string, input: OrderCheckoutInput) {
    return this.orderRepository.createDraft(tenantId, input);
  }
}

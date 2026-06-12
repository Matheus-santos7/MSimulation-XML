import type { OrderRepository } from "../../domain/ports/order.repository.js";

export class GetOrderByIdUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(tenantId: string, id: string) {
    return this.orderRepository.findById(tenantId, id);
  }
}

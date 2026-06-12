import type { OrderRepository } from "../../domain/ports/order.repository.js";

export class RemoveOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(tenantId: string, id: string) {
    return this.orderRepository.delete(id, tenantId);
  }
}

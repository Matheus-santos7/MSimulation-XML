import type { OrderRepository } from "../../domain/ports/order.repository.js";

export class ListOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(tenantId: string) {
    return this.orderRepository.listByTenant(tenantId);
  }
}

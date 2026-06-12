import type { OrderRepository } from "../../domain/ports/order.repository.js";

/**
 * Remove permanentemente um pedido do tenant.
 *
 * @param tenantId - Tenant emitente
 * @param id - UUID do pedido
 * @returns `true` se removido, `false` se não existir
 */
export class RemoveOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(tenantId: string, id: string) {
    return this.orderRepository.delete(id, tenantId);
  }
}

import type { OrderRepository } from "../../domain/ports/order.repository.js";

/**
 * Obtém um pedido pelo identificador, respeitando isolamento por tenant.
 *
 * @param tenantId - Tenant do utilizador autenticado
 * @param id - UUID do pedido
 * @returns Pedido completo ou `null` se não existir neste tenant
 */
export class GetOrderByIdUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(tenantId: string, id: string) {
    return this.orderRepository.findById(tenantId, id);
  }
}

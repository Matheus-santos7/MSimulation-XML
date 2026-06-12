import type { OrderRepository } from "../../domain/ports/order.repository.js";

/**
 * Lista todos os pedidos do tenant, ordenados por status e data de atualização.
 *
 * @param tenantId - Identificador do tenant (empresa emitente)
 * @returns Pedidos com produto resumido e NF-e vinculada quando faturado
 */
export class ListOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(tenantId: string) {
    return this.orderRepository.listByTenant(tenantId);
  }
}

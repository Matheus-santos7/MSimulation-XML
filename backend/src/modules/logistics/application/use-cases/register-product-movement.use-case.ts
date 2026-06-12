import type {
  ProductMovementRepository,
  RegisterProductMovementData,
} from "../../domain/ports/product-movement.repository.js";

/**
 * Regista movimentação de produto após emissão fiscal.
 *
 * Invocado pelo módulo **remessas** (remessa inicial, avanço CD) dentro ou fora de transação.
 *
 * @param data - Tipo de operação, quantidade, NF-e e CDs origem/destino
 * @param db - Cliente Prisma ou transação opcional
 */
export class RegisterProductMovementUseCase {
  constructor(private readonly productMovementRepository: ProductMovementRepository) {}

  execute(data: RegisterProductMovementData, db?: unknown) {
    return this.productMovementRepository.register(data, db);
  }
}

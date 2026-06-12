import type {
  ProductMovementRepository,
  RegisterProductMovementData,
} from "../../domain/ports/product-movement.repository.js";

export class RegisterProductMovementUseCase {
  constructor(private readonly productMovementRepository: ProductMovementRepository) {}

  execute(data: RegisterProductMovementData, db?: unknown) {
    return this.productMovementRepository.register(data, db);
  }
}

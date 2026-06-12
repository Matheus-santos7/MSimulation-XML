import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

/**
 * Busca unidade logística ativa por ID (uso interno / avanço de mercadoria).
 *
 * @param unitId - UUID da unidade
 * @returns Resumo da unidade ou `null` se inativa ou inexistente
 */
export class GetActiveLogisticsUnitUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(unitId: string) {
    return this.logisticsUnitRepository.findActiveById(unitId);
  }
}

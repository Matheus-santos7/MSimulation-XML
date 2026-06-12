import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

/**
 * Busca unidade logística ativa pelo código ML (ex.: `BRSP01`).
 *
 * @param code - Código normalizado (trim + uppercase no repository)
 * @returns Resumo da unidade ou `null`
 */
export class GetActiveLogisticsUnitByCodeUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(code: string) {
    return this.logisticsUnitRepository.findActiveByCode(code);
  }
}

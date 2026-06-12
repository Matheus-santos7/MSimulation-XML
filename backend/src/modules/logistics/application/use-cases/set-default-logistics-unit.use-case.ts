import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

/**
 * Define o CD padrão do tenant para remessas sem destino explícito.
 *
 * @param tenantId - Tenant emitente
 * @param unitId - UUID da unidade a marcar como `padrao`
 * @returns Unidade atualizada
 * @throws {LogisticsUnitError} Unidade inexistente ou inativa
 */
export class SetDefaultLogisticsUnitUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, unitId: string) {
    return this.logisticsUnitRepository.setDefaultUnit(tenantId, unitId);
  }
}

import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

/**
 * Resolve destino fiscal de remessa: CD informado ou unidade padrão do tenant.
 *
 * Usado pelo módulo **remessas** na emissão de remessa física inicial.
 *
 * @param tenantId - Tenant emitente
 * @param destinationUnitId - Opcional; se omitido, usa CD `padrao`
 * @returns Dados do destinatário fiscal para NF-e
 * @throws {LogisticsUnitError} CD inválido ou sem padrão configurado
 */
export class ResolveShipmentDestinationUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, destinationUnitId?: string) {
    return this.logisticsUnitRepository.resolveShipmentDestination(tenantId, destinationUnitId);
  }
}

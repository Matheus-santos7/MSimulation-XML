import type { EmitterSettingsRepository } from "../../domain/ports/emitter-settings.repository.js";
import type { NfeNumeracaoView } from "../../domain/entities/emitter-settings-view.entity.js";

/**
 * Retorna preview de numeração NF-e para uma série (última emitida + próximo número).
 */
export class GetNfeNumeracaoPreviewUseCase {
  constructor(private readonly emitterSettingsRepository: EmitterSettingsRepository) {}

  async execute(
    tenantId: string,
    serie: number,
    numeroInicial: number,
  ): Promise<NfeNumeracaoView | null> {
    return this.emitterSettingsRepository.getNumeracaoForSerie(tenantId, serie, numeroInicial);
  }
}

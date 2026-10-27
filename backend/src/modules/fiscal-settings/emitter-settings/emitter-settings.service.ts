import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EmitterSettingsRepository } from "./emitter-settings.repository.js";
import type {
  EmitterSettingsView,
  NfeNumeracaoView,
  UpdateEmitterSettingsInput,
} from "./emitter-settings.types.js";

const TENANT_NOT_FOUND = "Empresa não encontrada";

/**
 * Configuração padrão do emissor da empresa (vale para todos os marketplaces sem sobrescrita).
 * Alterações afetam só emissões futuras.
 */
@Injectable()
export class EmitterSettingsService {
  constructor(
    @Inject(EmitterSettingsRepository) private readonly repository: EmitterSettingsRepository,
  ) {}

  async get(tenantId: string): Promise<EmitterSettingsView> {
    return this.orNotFound(await this.repository.getByTenantId(tenantId));
  }

  async update(tenantId: string, input: UpdateEmitterSettingsInput): Promise<EmitterSettingsView> {
    return this.orNotFound(await this.repository.update(tenantId, input));
  }

  async numeracaoPreview(
    tenantId: string,
    serie: number,
    numeroInicial: number,
  ): Promise<NfeNumeracaoView> {
    return this.orNotFound(
      await this.repository.getNumeracaoForSerie(tenantId, serie, numeroInicial),
    );
  }

  private orNotFound<T>(value: T | null): T {
    if (value == null) throw new NotFoundException(TENANT_NOT_FOUND);

    return value;
  }
}

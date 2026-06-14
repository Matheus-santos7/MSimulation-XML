import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { runInTransaction } from "../../../../lib/db/prisma-tx.js";
import { mergeFiscalEmitterSettings } from "../../domain/services/fiscal-emitter-settings-defaults.js";
import type { EmitterSettingsView } from "../../domain/entities/emitter-settings-view.entity.js";
import type {
  EmitterSettingsRepository,
  UpdateEmitterSettingsInput,
} from "../../domain/ports/emitter-settings.repository.js";
import {
  DEFAULT_FISCAL_EMITTER_SETTINGS,
  mergeEmitterSettingsPatch,
} from "../../application/services/merge-emitter-settings-patch.service.js";

/**
 * Implementação Prisma do port {@link EmitterSettingsRepository}.
 *
 * Persiste JSON em `fiscal_emitter_settings.settings`; séries em `tenant`.
 */
export class PrismaEmitterSettingsRepository implements EmitterSettingsRepository {
  constructor(private readonly prisma: DbClient) {}

  /** @inheritdoc */
  async getByTenantId(tenantId: string): Promise<EmitterSettingsView | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { fiscalEmitterSettings: true },
    });
    if (!tenant) return null;

    const taxRulesCount = await this.countDistinctTaxRuleGroups(tenantId);
    const settings = tenant.fiscalEmitterSettings
      ? mergeFiscalEmitterSettings(tenant.fiscalEmitterSettings.settings)
      : DEFAULT_FISCAL_EMITTER_SETTINGS;

    return {
      tenantId,
      serieRemessa: tenant.serieRemessa,
      serieCte: tenant.serieCte,
      taxRulesCount,
      settings,
    };
  }

  /** @inheritdoc */
  async update(
    tenantId: string,
    input: UpdateEmitterSettingsInput,
  ): Promise<EmitterSettingsView | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { fiscalEmitterSettings: true },
    });
    if (!tenant) return null;

    const currentSettings = tenant.fiscalEmitterSettings
      ? mergeFiscalEmitterSettings(tenant.fiscalEmitterSettings.settings)
      : DEFAULT_FISCAL_EMITTER_SETTINGS;

    const nextSettings = mergeEmitterSettingsPatch(currentSettings, input);
    const { serieRemessa, serieCte } = input;

    await runInTransaction(this.prisma, async (tx) => {
      if (serieRemessa != null || serieCte != null) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            ...(serieRemessa != null ? { serieRemessa } : {}),
            ...(serieCte != null ? { serieCte } : {}),
          },
        });
      }

      await tx.fiscalEmitterSettings.upsert({
        where: { tenantId },
        create: { tenantId, settings: nextSettings },
        update: { settings: nextSettings },
      });
    });

    return this.getByTenantId(tenantId);
  }

  /** Conta grupos de regra por nome normalizado (sem sufixo UF). */
  private async countDistinctTaxRuleGroups(tenantId: string): Promise<number> {
    const ruleRows = await this.prisma.taxRule.findMany({
      where: { tenantId },
      select: { nome: true },
    });
    return new Set(
      ruleRows.map((row) => row.nome.replace(/\s*\([^)]*\)\s*$/i, "").trim()),
    ).size;
  }
}

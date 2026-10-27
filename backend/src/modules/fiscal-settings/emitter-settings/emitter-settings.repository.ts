import { Injectable } from "@nestjs/common";
import { runInTransaction } from "../../../lib/db/prisma-tx.js";
import { computeProximoNumeroNfe } from "@msimulation-xml/fiscal-core";
import { mergeFiscalEmitterSettings } from "./rules/fiscal-emitter-settings-defaults.js";
import type {
  EmitterSettingsView,
  NfeNumeracaoView,
  UpdateEmitterSettingsInput,
} from "./emitter-settings.types.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import {
  DEFAULT_FISCAL_EMITTER_SETTINGS,
  mergeEmitterSettingsPatch,
} from "./rules/merge-emitter-settings-patch.js";
// Import direto da regra (e não do index): o index do fiscal-documents carrega o XML, que
// depende do fiscal-settings e fecharia um ciclo.
import {
  ultimoNumeroNfe,
  listInutilizacoesSerie,
} from "../../fiscal-documents/nfe/rules/nfe-sequencia.js";

/**
 * Configuração padrão do emissor da empresa: JSON em `fiscal_emitter_settings.settings`,
 * séries em `tenant`.
 */
@Injectable()
export class EmitterSettingsRepository {
  private get db() {
    return getDbClient();
  }

  /** Vista agregada; defaults quando a empresa ainda não personalizou. `null` sem empresa. */
  async getByTenantId(tenantId: string): Promise<EmitterSettingsView | null> {
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      include: { fiscalEmitterSettings: true },
    });
    if (!tenant) return null;

    return this.buildView(tenantId, tenant);
  }

  /** Aplica o patch em transação (`tenant` + `fiscal_emitter_settings`). `null` sem empresa. */
  async update(
    tenantId: string,
    input: UpdateEmitterSettingsInput,
  ): Promise<EmitterSettingsView | null> {
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      include: { fiscalEmitterSettings: true },
    });
    if (!tenant) return null;

    const currentSettings = tenant.fiscalEmitterSettings
      ? mergeFiscalEmitterSettings(tenant.fiscalEmitterSettings.settings)
      : DEFAULT_FISCAL_EMITTER_SETTINGS;

    const nextSettings = mergeEmitterSettingsPatch(currentSettings, input);
    const { serieRemessa, serieTransferencia, serieCte } = input;

    await runInTransaction(this.db, async (tx) => {
      if (serieRemessa != null || serieTransferencia != null || serieCte != null) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            ...(serieRemessa != null ? { serieRemessa } : {}),
            ...(serieTransferencia != null ? { serieTransferencia } : {}),
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

    return this.buildView(tenantId, {
      ...tenant,
      serieRemessa: serieRemessa ?? tenant.serieRemessa,
      serieTransferencia: serieTransferencia ?? tenant.serieTransferencia,
      serieCte: serieCte ?? tenant.serieCte,
      fiscalEmitterSettings: { settings: nextSettings },
    });
  }

  private async buildView(
    tenantId: string,
    tenant: {
      serieRemessa: number;
      serieTransferencia: number;
      serieCte: number;
      fiscalEmitterSettings: { settings: unknown } | null;
    },
  ): Promise<EmitterSettingsView> {
    const taxRulesCount = await this.countDistinctTaxRuleGroups(tenantId);
    const settings = tenant.fiscalEmitterSettings
      ? mergeFiscalEmitterSettings(tenant.fiscalEmitterSettings.settings)
      : DEFAULT_FISCAL_EMITTER_SETTINGS;
    const numeracaoNfe = await this.buildNumeracaoNfeView(tenantId, tenant, settings);

    return {
      tenantId,
      serieRemessa: tenant.serieRemessa,
      serieTransferencia: tenant.serieTransferencia,
      serieCte: tenant.serieCte,
      taxRulesCount,
      numeracaoNfe,
      settings,
    };
  }

  /** Conta grupos de regra por nome normalizado (sem sufixo UF). */
  private async countDistinctTaxRuleGroups(tenantId: string): Promise<number> {
    const ruleRows = await this.db.taxRule.findMany({
      where: { tenantId },
      select: { nome: true },
    });
    return new Set(ruleRows.map((row) => row.nome.replace(/\s*\([^)]*\)\s*$/i, "").trim())).size;
  }

  /** Monta contadores de numeração NF-e para exibição e edição na UI. */
  private async buildNumeracaoNfeView(
    tenantId: string,
    tenant: { serieRemessa: number; serieTransferencia: number },
    settings: EmitterSettingsView["settings"],
  ): Promise<EmitterSettingsView["numeracaoNfe"]> {
    const build = async (
      serie: number,
      kind: "remessa" | "transferencia",
    ): Promise<NfeNumeracaoView> => {
      const [ultimoEmitido, inutilizacoes] = await Promise.all([
        ultimoNumeroNfe(this.db, tenantId, serie),
        listInutilizacoesSerie(this.db, tenantId, serie),
      ]);
      const numeroInicial = settings.nfe.numeracao?.[kind]?.numeroInicial ?? 1;
      return {
        numeroInicial,
        ultimoEmitido,
        proximoNumero: computeProximoNumeroNfe(ultimoEmitido, numeroInicial, inutilizacoes),
      };
    };

    return {
      remessa: await build(tenant.serieRemessa, "remessa"),
      transferencia: await build(tenant.serieTransferencia, "transferencia"),
    };
  }

  /** Última NF-e emitida e próximo número de uma série. `null` sem empresa. */
  async getNumeracaoForSerie(
    tenantId: string,
    serie: number,
    numeroInicial: number,
  ): Promise<NfeNumeracaoView | null> {
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) return null;

    const floor = Math.max(1, Math.trunc(numeroInicial) || 1);
    const [ultimoEmitido, inutilizacoes] = await Promise.all([
      ultimoNumeroNfe(this.db, tenantId, serie),
      listInutilizacoesSerie(this.db, tenantId, serie),
    ]);
    return {
      numeroInicial: floor,
      ultimoEmitido,
      proximoNumero: computeProximoNumeroNfe(ultimoEmitido, floor, inutilizacoes),
    };
  }
}

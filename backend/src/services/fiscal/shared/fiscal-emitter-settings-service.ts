import type { PrismaClient } from "../../../generated/prisma/client.js";
import {
  DEFAULT_FISCAL_EMITTER_SETTINGS,
  mergeFiscalEmitterSettings,
  type FiscalEmitterSettingsData,
} from "../../../lib/fiscal/fiscal-emitter-settings-defaults.js";
import type { fiscalEmitterSettingsPatchBody } from "../../../schemas/fiscal/emitter-settings.js";
import type { z } from "zod";

type PatchInput = z.infer<typeof fiscalEmitterSettingsPatchBody>;

export type FiscalEmitterSettingsView = {
  tenantId: string;
  serieRemessa: number;
  serieCte: number;
  taxRulesCount: number;
  settings: FiscalEmitterSettingsData;
};

export class FiscalEmitterSettingsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getView(tenantId: string): Promise<FiscalEmitterSettingsView | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { fiscalEmitterSettings: true },
    });
    if (!tenant) return null;

    const ruleRows = await this.prisma.taxRule.findMany({
      where: { tenantId },
      select: { nome: true },
    });
    const taxRulesCount = new Set(
      ruleRows.map((r) => r.nome.replace(/\s*\([^)]*\)\s*$/i, "").trim()),
    ).size;

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

  async patch(tenantId: string, body: PatchInput): Promise<FiscalEmitterSettingsView | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { fiscalEmitterSettings: true },
    });
    if (!tenant) return null;

    const current = tenant.fiscalEmitterSettings
      ? mergeFiscalEmitterSettings(tenant.fiscalEmitterSettings.settings)
      : DEFAULT_FISCAL_EMITTER_SETTINGS;

    const { serieRemessa, serieCte, basic, taxes, nfe } = body;
    const next = mergeFiscalEmitterSettings({
      basic: { ...current.basic, ...(basic ?? {}) },
      taxes: {
        ...current.taxes,
        ...(taxes ?? {}),
        ...(taxes?.cstDevolucao
          ? { cstDevolucao: { ...current.taxes.cstDevolucao, ...taxes.cstDevolucao } }
          : {}),
        ...(taxes?.composicaoBaseCalculo
          ? {
              composicaoBaseCalculo: {
                ...current.taxes.composicaoBaseCalculo,
                ...taxes.composicaoBaseCalculo,
              },
            }
          : {}),
        ...(taxes?.calculoDifal
          ? {
              calculoDifal: {
                ...current.taxes.calculoDifal,
                ...taxes.calculoDifal,
                porUf: {
                  ...current.taxes.calculoDifal.porUf,
                  ...((taxes.calculoDifal as { porUf?: Record<string, string> }).porUf ?? {}),
                },
              },
            }
          : {}),
        ...(taxes?.modalidadeFrete
          ? { modalidadeFrete: { ...current.taxes.modalidadeFrete, ...taxes.modalidadeFrete } }
          : {}),
        ...(taxes?.emissaoGnre
          ? { emissaoGnre: { ...current.taxes.emissaoGnre, ...taxes.emissaoGnre } }
          : {}),
      },
      nfe: {
        ...current.nfe,
        ...(nfe ?? {}),
        ...(nfe?.prazoCancelamento
          ? { prazoCancelamento: { ...current.nfe.prazoCancelamento, ...nfe.prazoCancelamento } }
          : {}),
        ...(nfe?.contatos ? { contatos: nfe.contatos } : {}),
      },
    });

    await this.prisma.$transaction(async (tx) => {
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
        create: { tenantId, settings: next },
        update: { settings: next },
      });
    });

    return this.getView(tenantId);
  }
}

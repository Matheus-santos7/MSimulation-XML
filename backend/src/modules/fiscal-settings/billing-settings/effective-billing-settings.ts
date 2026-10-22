/**
 * Configuração do faturador usada na emissão (remessas, sales, fiscal-documents).
 *
 * `loadEmitterSettings(db, tenantId, marketplace)` é o único ponto que monta a configuração
 * efetiva: padrão da empresa + sobrescrita do marketplace. Sem marketplace, devolve o padrão.
 * `enrichTaxSnapshot` aplica essa configuração no snapshot tributário (fiscal-core).
 */
import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import type { NFeTipo } from "../../../generated/prisma/client.js";
import {
  enrichTaxSnapshot as enrichTaxSnapshotCore,
  type EnrichTaxContext as EnrichTaxContextCore,
  type EmitterSnapshot,
  type FiscalEmitterSettingsData,
  type TaxSnapshot,
} from "@msimulation-xml/fiscal-core";
import { mergeFiscalEmitterSettings } from "../emitter-settings/rules/fiscal-emitter-settings-defaults.js";
import {
  applyMarketplaceOverrides,
  parseMarketplaceOverrides,
} from "../marketplace-billing-settings/rules/apply-marketplace-overrides.js";
import type { NFeTipoValue } from "@msimulation-xml/fiscal-core";

export type { EmitterSnapshot, FiscalEmitterSettingsData, TaxSnapshot };
export {
  calcTributoBase,
  composicaoChannel,
  mapCstDevolucao,
  resolveDifalMode,
  resolveModFrete,
} from "@msimulation-xml/fiscal-core";

export type EnrichTaxContext = Omit<EnrichTaxContextCore, "tipo"> & { tipo: NFeTipo };

export function enrichTaxSnapshot(snapshot: TaxSnapshot, ctx: EnrichTaxContext): TaxSnapshot {
  return enrichTaxSnapshotCore(snapshot, {
    ...ctx,
    tipo: ctx.tipo as NFeTipoValue,
  });
}

type EmitterSettingsDb = {
  fiscalEmitterSettings: {
    findUnique: (args: { where: { tenantId: string } }) => Promise<{ settings: unknown } | null>;
  };
  marketplaceBillingSettings: {
    findUnique: (args: {
      where: { tenantId_marketplace: { tenantId: string; marketplace: MarketplaceCode } };
    }) => Promise<{ overrides: unknown } | null>;
  };
};

export async function loadEmitterSettings(
  prisma: EmitterSettingsDb,
  tenantId: string,
  marketplace?: MarketplaceCode,
): Promise<FiscalEmitterSettingsData> {
  const row = await prisma.fiscalEmitterSettings.findUnique({ where: { tenantId } });
  const tenantDefaults = mergeFiscalEmitterSettings(row?.settings);
  if (!marketplace) return tenantDefaults;

  const overrideRow = await prisma.marketplaceBillingSettings.findUnique({
    where: { tenantId_marketplace: { tenantId, marketplace } },
  });

  return applyMarketplaceOverrides(
    tenantDefaults,
    parseMarketplaceOverrides(overrideRow?.overrides),
  );
}

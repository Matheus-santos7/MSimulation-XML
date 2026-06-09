import type { NFeTipo } from "../../generated/prisma/client.js";
import {
  enrichTaxSnapshot as enrichTaxSnapshotCore,
  type EnrichTaxContext as EnrichTaxContextCore,
  type EmitterSnapshot,
  type FiscalEmitterSettingsData,
  type TaxSnapshot,
} from "@msimulation-xml/fiscal-core";
import { mergeFiscalEmitterSettings } from "./fiscal-emitter-settings-defaults.js";
import type { NFeTipoValue } from "@msimulation-xml/fiscal-core";

export type { EmitterSnapshot, FiscalEmitterSettingsData, TaxSnapshot };
export { calcTributoBase, composicaoChannel, mapCstDevolucao, resolveDifalMode, resolveModFrete } from "@msimulation-xml/fiscal-core";

export type EnrichTaxContext = Omit<EnrichTaxContextCore, "tipo"> & { tipo: NFeTipo };

export function enrichTaxSnapshot(snapshot: TaxSnapshot, ctx: EnrichTaxContext): TaxSnapshot {
  return enrichTaxSnapshotCore(snapshot, {
    ...ctx,
    tipo: ctx.tipo as NFeTipoValue,
  });
}

export async function loadEmitterSettings(
  prisma: {
    fiscalEmitterSettings: {
      findUnique: (args: { where: { tenantId: string } }) => Promise<{ settings: unknown } | null>;
    };
  },
  tenantId: string,
): Promise<FiscalEmitterSettingsData> {
  const row = await prisma.fiscalEmitterSettings.findUnique({ where: { tenantId } });
  return mergeFiscalEmitterSettings(row?.settings);
}

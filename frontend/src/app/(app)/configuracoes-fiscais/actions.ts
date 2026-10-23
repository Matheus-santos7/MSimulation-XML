"use server";

import { revalidatePath } from "next/cache";
import {
  patchFiscalEmitterSettings,
  replaceMarketplaceBillingSettings,
  type MarketplaceBillingOverrides,
} from "@/lib/fiscal-api";
import type { FiscalEmitterSettingsPatch } from "@/lib/fiscal-emitter-settings-types";
import type { MarketplaceCode } from "@/lib/marketplaces";

export async function salvarConfiguracoesFiscaisAction(
  patch: FiscalEmitterSettingsPatch,
  extraPaths: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await patchFiscalEmitterSettings(patch);
    revalidatePath("/configuracoes-fiscais");
    revalidatePath("/configuracoes-fiscais", "layout");
    for (const path of extraPaths) {
      revalidatePath(path);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar" };
  }
}

export async function salvarFaturadorMarketplaceAction(
  marketplace: MarketplaceCode,
  overrides: MarketplaceBillingOverrides,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await replaceMarketplaceBillingSettings(marketplace, overrides);
    revalidatePath("/configuracoes-fiscais");
    revalidatePath(`/configuracoes-fiscais/marketplaces/${marketplace}`);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar" };
  }
}

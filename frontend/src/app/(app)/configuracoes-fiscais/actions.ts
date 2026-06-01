"use server";

import { revalidatePath } from "next/cache";
import { patchFiscalEmitterSettings } from "@/lib/fiscal-api";
import type { FiscalEmitterSettingsPatch } from "@/lib/fiscal-emitter-settings-types";

export async function salvarConfiguracoesFiscaisAction(
  patch: FiscalEmitterSettingsPatch,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await patchFiscalEmitterSettings(patch);
    revalidatePath("/configuracoes-fiscais");
    revalidatePath("/configuracoes-fiscais", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar" };
  }
}

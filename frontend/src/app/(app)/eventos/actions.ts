"use server";

import { revalidatePath } from "next/cache";
import { inutilizarNumeracao } from "@/lib/fiscal-api";

export async function inutilizarNumeracaoAction(input: {
  serie: number;
  numeroIni: number;
  numeroFim: number;
  xJust?: string;
}): Promise<{ error?: string }> {
  try {
    await inutilizarNumeracao(input);
    revalidatePath("/eventos");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao inutilizar numeração" };
  }
}

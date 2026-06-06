"use server";

import { revalidatePath } from "next/cache";
import { emitirRemessaManual } from "@/lib/fiscal-api";

export type RemessaManualState = {
  error?: string;
  success?: boolean;
  chaveNfe?: string;
  chaveCte?: string;
};

export async function emitirRemessaManualAction(
  _prev: RemessaManualState,
  formData: FormData,
): Promise<RemessaManualState> {
  const productId = String(formData.get("productId") ?? "");
  const unidadeDestinoId = String(formData.get("unidadeDestinoId") ?? "");
  const quantidade = Number(formData.get("quantidade") ?? 0);

  if (!productId || !unidadeDestinoId) {
    return { error: "Selecione produto e CD destino" };
  }
  if (!Number.isFinite(quantidade) || quantidade < 1) {
    return { error: "Quantidade inválida" };
  }

  try {
    const result = await emitirRemessaManual({
      productId,
      quantidade,
      unidadeDestinoId,
    });
    revalidatePath("/operacoes");
    revalidatePath("/nfe");
    revalidatePath("/cte");
    revalidatePath("/");
    return {
      success: true,
      chaveNfe: result.nfe.chave,
      chaveCte: result.cte.chave,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir remessa" };
  }
}

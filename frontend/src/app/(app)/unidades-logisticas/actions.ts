"use server";

import { revalidatePath } from "next/cache";
import { emitirAvancoCd, setUnidadeLogisticaPadrao } from "@/lib/fiscal-api";

export type AvancoCdState = {
  error?: string;
  success?: boolean;
  chaveRemessa?: string;
  chaveSimbolica?: string;
};

export async function emitirAvancoCdAction(
  _prev: AvancoCdState,
  formData: FormData,
): Promise<AvancoCdState> {
  const productId = String(formData.get("productId") ?? "");
  const unidadeOrigemId = String(formData.get("unidadeOrigemId") ?? "");
  const unidadeDestinoId = String(formData.get("unidadeDestinoId") ?? "");
  const quantidade = Number(formData.get("quantidade") ?? 0);

  if (!productId || !unidadeOrigemId || !unidadeDestinoId) {
    return { error: "Preencha produto, CD origem e CD destino" };
  }
  if (!Number.isFinite(quantidade) || quantidade < 1) {
    return { error: "Quantidade inválida" };
  }

  try {
    const result = await emitirAvancoCd({
      productId,
      quantidade,
      unidadeOrigemId,
      unidadeDestinoId,
    });
    revalidatePath("/unidades-logisticas");
    revalidatePath("/nfe");
    return {
      success: true,
      chaveRemessa: result.remessaDestino.chave,
      chaveSimbolica: result.remessaSimbolica.chave,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir avanço" };
  }
}

export async function definirUnidadePadraoAction(
  unidadeId: string,
): Promise<{ error?: string; codigo?: string }> {
  try {
    const unidade = await setUnidadeLogisticaPadrao(unidadeId);
    revalidatePath("/unidades-logisticas");
    revalidatePath("/operacoes");
    revalidatePath("/produtos");
    return { codigo: unidade.codigo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao definir padrão" };
  }
}

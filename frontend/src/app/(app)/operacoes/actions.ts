"use server";

import { revalidatePath } from "next/cache";
import { emitirRemessaManual } from "@/lib/fiscal-api";

export type RemessaManualState = {
  error?: string;
  success?: boolean;
  chaveNfe?: string;
  chaveCte?: string;
  totalItens?: number;
};

export async function emitirRemessaManualAction(
  _prev: RemessaManualState,
  formData: FormData,
): Promise<RemessaManualState> {
  const unidadeDestinoId = String(formData.get("unidadeDestinoId") ?? "");
  const productIds = formData.getAll("productId").map(String);
  const productSkus = formData.getAll("productSku").map(String);
  const quantidades = formData.getAll("quantidade").map((v) => Number(v));

  if (!unidadeDestinoId) {
    return { error: "Selecione o CD destino" };
  }
  if (productIds.length === 0) {
    return { error: "Adicione ao menos um produto" };
  }
  if (productIds.length !== quantidades.length) {
    return { error: "Linhas de produto incompletas" };
  }

  const items: { productId: string; productSku?: string; quantidade: number }[] = [];
  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i]?.trim() ?? "";
    const productSku = productSkus[i]?.trim() ?? "";
    const quantidade = quantidades[i] ?? 0;
    if (!productId) {
      return { error: `Selecione o produto na linha ${i + 1}` };
    }
    if (!Number.isFinite(quantidade) || quantidade < 1) {
      return { error: `Quantidade inválida na linha ${i + 1}` };
    }
    items.push({
      productId,
      productSku: productSku || undefined,
      quantidade,
    });
  }

  try {
    const result = await emitirRemessaManual({
      unidadeDestinoId,
      items,
    });
    revalidatePath("/operacoes");
    revalidatePath("/nfe");
    revalidatePath("/cte");
    revalidatePath("/");
    return {
      success: true,
      chaveNfe: result.nfe.chave,
      chaveCte: result.cte.chave,
      totalItens: result.nfe.itens?.length ?? items.length,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir remessa" };
  }
}

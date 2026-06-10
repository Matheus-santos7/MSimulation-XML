"use server";

import { revalidatePath } from "next/cache";
import {
  emitirAvancoCd,
  emitirRemessaManual,
  listSaldoRemessaPorCd,
  realignRemessaFifo,
  setUnidadeLogisticaPadrao,
} from "@/lib/fiscal-api";
import type { SaldoRemessaCdDto } from "@/lib/fiscal-api";

export type AvancoCdState = {
  error?: string;
  success?: boolean;
  chaveRetorno?: string;
  chaveSimbolica?: string;
};

export async function listarSaldoCdRemessaAction(
  productId: string,
  productSku?: string,
): Promise<SaldoRemessaCdDto[]> {
  if (!productId) return [];
  return listSaldoRemessaPorCd(productId, productSku);
}

function readAvancoField(formData: FormData, key: string): string {
  return String(formData.get(`avanco_${key}`) ?? "").trim();
}

export async function emitirAvancoCdAction(
  _prev: AvancoCdState,
  formData: FormData,
): Promise<AvancoCdState> {
  const productId = readAvancoField(formData, "productId");
  const productSku = readAvancoField(formData, "productSku");
  const unidadeOrigemId = readAvancoField(formData, "unidadeOrigemId");
  const unidadeDestinoId = readAvancoField(formData, "unidadeDestinoId");
  const quantidade = Number(readAvancoField(formData, "quantidade"));

  if (!productId || !unidadeOrigemId || !unidadeDestinoId) {
    return { error: "Preencha produto, CD origem e CD destino" };
  }
  if (!Number.isFinite(quantidade) || quantidade < 1) {
    return { error: "Quantidade inválida" };
  }

  try {
    const result = await emitirAvancoCd({
      productId,
      productSku: productSku || undefined,
      quantidade,
      unidadeOrigemId,
      unidadeDestinoId,
    });
    revalidatePath("/unidades-logisticas");
    revalidatePath("/operacoes");
    revalidatePath("/nfe");
    return {
      success: true,
      chaveRetorno: result.retornoSimbolico.chave,
      chaveSimbolica: result.remessaSimbolica.chave,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir avanço" };
  }
}

export type RemessaCdOrigemState = {
  error?: string;
  success?: boolean;
  chaveNfe?: string;
  chaveCte?: string;
  realinhados?: number;
};

/** Corrige vínculo FIFO e emite nova remessa física para o CD de origem (saldo). */
export async function emitirRemessaCdOrigemAction(
  _prev: RemessaCdOrigemState,
  formData: FormData,
): Promise<RemessaCdOrigemState> {
  const productId = readAvancoField(formData, "productId");
  const productSku = readAvancoField(formData, "productSku");
  const unidadeDestinoId = readAvancoField(formData, "unidadeOrigemId");
  const quantidade = Number(readAvancoField(formData, "quantidade"));

  if (!productId || !unidadeDestinoId) {
    return { error: "Selecione produto e CD de origem" };
  }
  if (!Number.isFinite(quantidade) || quantidade < 1) {
    return { error: "Quantidade inválida" };
  }

  try {
    let realinhados = 0;
    if (productSku) {
      const relink = await realignRemessaFifo(productSku);
      realinhados = relink.atualizados;
    }

    const result = await emitirRemessaManual({
      unidadeDestinoId,
      items: [{ productId, productSku: productSku || undefined, quantidade }],
    });

    revalidatePath("/operacoes");
    revalidatePath("/unidades-logisticas");
    revalidatePath("/nfe");
    revalidatePath("/cte");

    return {
      success: true,
      chaveNfe: result.nfe.chave,
      chaveCte: result.cte.chave,
      realinhados,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir remessa" };
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

"use server";

import { revalidatePath } from "next/cache";
import {
  cancelSale,
  deleteNfe,
  emitInboundConference,
  emitInsucessoNote,
  emitRetornoFisicoNote,
  emitReturnNote,
  getInboundConferenceExpected,
  getReturnableItems,
  type DevolucaoDisponivel,
  type DevolucaoItemInput,
} from "@/lib/fiscal-api";

export async function excluirNfeAction(chave: string): Promise<{ error?: string }> {
  try {
    await deleteNfe(chave);
    revalidatePath("/nfe");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao remover NF-e" };
  }
}

export async function carregarItensDevolucaoAction(
  chave: string,
): Promise<{ error?: string; disponivel?: DevolucaoDisponivel }> {
  try {
    const disponivel = await getReturnableItems(chave);
    return { disponivel };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erro ao carregar itens da venda",
    };
  }
}

/** Sem `itens` devolve tudo que ainda resta da venda. */
export async function devolverVendaAction(
  chave: string,
  itens?: DevolucaoItemInput[],
): Promise<{ error?: string; numero?: number; serie?: number }> {
  try {
    const { devolucao } = await emitReturnNote(chave, itens);
    revalidatePath("/nfe");
    revalidatePath("/");
    revalidatePath("/eventos");
    return { numero: devolucao.numero, serie: devolucao.serie };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir devolução" };
  }
}

export async function emitirInsucessoAction(
  chave: string,
): Promise<{ error?: string; numero?: number; serie?: number }> {
  try {
    const { devolucao } = await emitInsucessoNote(chave);
    revalidatePath("/nfe");
    revalidatePath("/");
    revalidatePath("/eventos");
    return { numero: devolucao.numero, serie: devolucao.serie };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir insucesso de entrega" };
  }
}

export async function emitirRetornoFisicoAction(
  chave: string,
): Promise<{ error?: string; numero?: number; serie?: number }> {
  try {
    const { retornoFisico } = await emitRetornoFisicoNote(chave);
    revalidatePath("/nfe");
    revalidatePath("/");
    revalidatePath("/eventos");
    return { numero: retornoFisico.numero, serie: retornoFisico.serie };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir retorno físico" };
  }
}

export async function emitirConferenciaRemessaAction(
  chave: string,
  receivedQty: number,
): Promise<{
  error?: string;
  noop?: boolean;
  expectedQty?: number;
  saldoApos?: number;
  negativeNumero?: number;
  positiveNumero?: number;
}> {
  try {
    const result = await emitInboundConference(chave, { receivedQty });
    revalidatePath("/nfe");
    revalidatePath("/");
    revalidatePath("/eventos");
    return {
      noop: result.noop,
      expectedQty: result.expectedQty,
      saldoApos: result.saldoApos,
      negativeNumero: result.negative?.numero,
      positiveNumero: result.positive?.numero,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro na conferência da remessa" };
  }
}

export async function carregarSaldoConferenciaAction(
  chave: string,
): Promise<{ error?: string; expectedQty?: number }> {
  try {
    const result = await getInboundConferenceExpected(chave);
    return { expectedQty: result.expectedQty };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erro ao carregar saldo de conferência",
    };
  }
}

export async function cancelarVendaAction(chave: string): Promise<{ error?: string }> {
  try {
    await cancelSale(chave);
    revalidatePath("/nfe");
    revalidatePath("/");
    revalidatePath("/eventos");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao cancelar venda" };
  }
}

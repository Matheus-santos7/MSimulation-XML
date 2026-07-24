"use server";

import { revalidatePath } from "next/cache";
import { cancelSale, deleteNfe, emitInboundConference, emitInsucessoNote, emitRetornoFisicoNote, emitReturnNote } from "@/lib/fiscal-api";

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

export async function devolverVendaAction(
  chave: string,
): Promise<{ error?: string; numero?: number; serie?: number }> {
  try {
    const { devolucao } = await emitReturnNote(chave);
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

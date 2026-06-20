"use server";

import { revalidatePath } from "next/cache";
import {
  emitWarehouseAdvance,
  emitManualShipment,
  importLogisticUnitsSpreadsheet,
  listRemessaBalanceByCd,
  realignRemessaFifo,
  setDefaultLogisticUnit,
} from "@/lib/fiscal-api";
import type { SaldoRemessaCdDto } from "@/lib/fiscal-api";
import { validateSpreadsheetFile } from "@/lib/spreadsheet-upload";

export type UnidadesLogisticasImportState = {
  error?: string;
  success?: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  totalPlanilha?: number;
  unicos?: number;
  parseErrors?: { line: number; message: string }[];
  errors?: { line: number; message: string }[];
};

export async function importarUnidadesLogisticasAction(
  _prev: UnidadesLogisticasImportState,
  formData: FormData,
): Promise<UnidadesLogisticasImportState> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Selecione um arquivo .xlsx" };
  }

  const validation = await validateSpreadsheetFile(file);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const enrichCepValues = formData.getAll("enrichCep").map(String);
  const enrichCep = !enrichCepValues.includes("false") || enrichCepValues.includes("true");

  try {
    const result = await importLogisticUnitsSpreadsheet(file, { enrichCep });
    revalidatePath("/unidades-logisticas");
    revalidatePath("/operacoes");
    revalidatePath("/produtos");
    return {
      success: true,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      totalPlanilha: result.totalPlanilha,
      unicos: result.unicos,
      parseErrors: result.parseErrors,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao importar planilha" };
  }
}

export type AvancoCdState = {
  error?: string;
  success?: boolean;
  chaveRetorno?: string;
  chaveSimbolica?: string;
  chaveCte?: string;
};

export async function listarSaldoCdRemessaAction(
  productId: string,
  productSku?: string,
): Promise<SaldoRemessaCdDto[]> {
  if (!productId) return [];
  return listRemessaBalanceByCd(productId, productSku);
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
    const result = await emitWarehouseAdvance({
      productId,
      productSku: productSku || undefined,
      quantidade,
      unidadeOrigemId,
      unidadeDestinoId,
    });
    revalidatePath("/unidades-logisticas");
    revalidatePath("/operacoes");
    revalidatePath("/nfe");
    revalidatePath("/cte");
    return {
      success: true,
      chaveRetorno: result.retornoSimbolico.chave,
      chaveSimbolica: result.remessaSimbolica.chave,
      chaveCte: result.cte.chave,
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

    const result = await emitManualShipment({
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
    const unidade = await setDefaultLogisticUnit(unidadeId);
    revalidatePath("/unidades-logisticas");
    revalidatePath("/operacoes");
    revalidatePath("/produtos");
    return { codigo: unidade.codigo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao definir padrão" };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ApiValidationError,
  createOrder,
  deleteOrder,
  invoiceOrder,
  updateOrder,
} from "@/lib/fiscal-api";
import { parsePedidoForm, type PedidoFormState } from "@/lib/pedido-form";
import { rethrowNavigationError } from "@/lib/auth/navigation";

function mapError(e: unknown): PedidoFormState {
  if (e instanceof ApiValidationError) {
    const msgs = Object.values(e.fieldErrors ?? {}).flat();
    return { error: msgs[0] ?? e.message, fieldErrors: e.fieldErrors };
  }
  return { error: e instanceof Error ? e.message : "Erro na operação" };
}

export async function salvarPedidoRascunhoAction(
  _prev: PedidoFormState,
  formData: FormData,
): Promise<PedidoFormState> {
  const pedidoId = String(formData.get("pedidoId") ?? "").trim() || null;

  try {
    const input = parsePedidoForm(formData);
    if (pedidoId) {
      await updateOrder(pedidoId, input);
    } else {
      await createOrder(input);
    }
    revalidatePath("/pedidos");
    return { success: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function faturarPedidoAction(
  _prev: PedidoFormState,
  formData: FormData,
): Promise<PedidoFormState> {
  const pedidoId = String(formData.get("pedidoId") ?? "").trim() || null;

  try {
    let id = pedidoId;
    if (!id) {
      const input = parsePedidoForm(formData);
      const created = await createOrder(input);
      id = created.id;
    } else {
      await updateOrder(id, parsePedidoForm(formData));
    }

    const { nfe } = await invoiceOrder(id);
    revalidatePath("/pedidos");
    revalidatePath("/nfe");
    revalidatePath("/operacoes");
    revalidatePath("/unidades-logisticas");
    revalidatePath("/");
    redirect(`/nfe/${nfe.chave}`);
  } catch (e) {
    rethrowNavigationError(e);
    return mapError(e);
  }
}

export async function excluirPedidoAction(id: string): Promise<{ error?: string }> {
  try {
    await deleteOrder(id);
    revalidatePath("/pedidos");
    revalidatePath("/nfe");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir pedido" };
  }
}

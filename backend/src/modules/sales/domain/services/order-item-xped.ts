import { gerarPedidoMl } from "../../../fiscal-documents/domain/services/nfe-chave.js";

/**
 * Garante orderId (`xPed`) por item — gera via `gerarPedidoMl` quando vazio.
 */
export function withEnsuredItemXPeds<T extends { xPed?: string | null }>(
  items: T[],
  generate: () => string = gerarPedidoMl,
): Array<T & { xPed: string }> {
  return items.map((item) => {
    const trimmed = item.xPed?.trim();
    return {
      ...item,
      xPed: trimmed && trimmed.length > 0 ? trimmed : generate(),
    };
  });
}

/**
 * Garante packId do pedido (`pedidoMl`) — gera quando ausente/branco.
 */
export function withEnsuredPackId(
  pedidoMl: string | undefined | null,
  generate: () => string = gerarPedidoMl,
): string {
  const trimmed = pedidoMl?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : generate();
}

/**
 * Identificador numérico estilo Mercado Livre (16 dígitos) — packId / orderId.
 * Espelha `gerarPedidoMl` do backend para uso no wizard (geração ao adicionar item).
 */
export function gerarPedidoMlClient(): string {
  const epochMs = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  const raw = `2${epochMs}${randomSuffix}`;
  return raw.slice(0, 16);
}

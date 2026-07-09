import type { PedidoFormValues } from "./pedido-form-types";

/**
 * Aplica dados de comprador/endereço de um exemplo sem sobrescrever
 * itens do pedido nem fretes já informados nas etapas anteriores.
 */
export function mergePedidoBuyerExample(
  current: PedidoFormValues,
  exampleValues: PedidoFormValues,
): PedidoFormValues {
  return {
    ...exampleValues,
    items: current.items.length > 0 ? current.items : exampleValues.items,
    freteConsumidor: current.freteConsumidor,
    freteSeller: current.freteSeller,
  };
}

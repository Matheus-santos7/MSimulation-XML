import { getMarketplaceProfile, type MarketplaceCode } from "@msimulation-xml/fiscal-core";
import { CheckoutError } from "../../errors/sales.errors.js";

/**
 * Id do pedido no marketplace (pack id no ML): o informado, validado pelo perfil do
 * marketplace, ou um gerado no formato dele.
 * @throws {CheckoutError} Id fora do formato do marketplace
 */
export function resolveMarketplaceOrderId(
  marketplace: MarketplaceCode,
  id: string | null | undefined,
): string {
  const { pedido } = getMarketplaceProfile(marketplace);
  const trimmed = id?.trim();
  if (!trimmed) return pedido.gerar();

  const error = pedido.validar(trimmed);
  if (error) throw new CheckoutError(error);

  return trimmed;
}

/** Garante o id por item (`xPed`), com a mesma regra do id do pedido. */
export function withMarketplaceItemOrderIds<T extends { xPed?: string | null }>(
  marketplace: MarketplaceCode,
  items: T[],
): Array<T & { xPed: string }> {
  return items.map((item) => ({
    ...item,
    xPed: resolveMarketplaceOrderId(marketplace, item.xPed),
  }));
}

import { CheckoutError } from "../errors/checkout.error.js";

export type OrderFreightInput = {
  freteConsumidor?: number;
  freteSeller?: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normaliza frete consumidor e seller do pedido (≥ 0, 2 casas).
 */
export function normalizeOrderFreight(input: OrderFreightInput) {
  const freteConsumidor = roundMoney(Number(input.freteConsumidor ?? 0));
  const freteSeller = roundMoney(Number(input.freteSeller ?? 0));
  return {
    freteConsumidor: Number.isFinite(freteConsumidor) && freteConsumidor > 0 ? freteConsumidor : 0,
    freteSeller: Number.isFinite(freteSeller) && freteSeller > 0 ? freteSeller : 0,
  };
}

/**
 * Exige ao menos um frete > 0 no pedido (consumidor na NF-e; seller complementa o CT-e).
 *
 * @throws {CheckoutError} Quando ambos os fretes são zero ou inválidos
 */
export function assertOrderFreightFilled(input: OrderFreightInput): void {
  const { freteConsumidor, freteSeller } = normalizeOrderFreight(input);
  if (freteConsumidor <= 0 && freteSeller <= 0) {
    throw new CheckoutError(
      "Informe frete consumidor e/ou frete seller — ao menos um deve ser maior que zero",
    );
  }
}

/**
 * Soma frete consumidor + seller para valor do CT-e de venda.
 */
export function sumOrderFreteCte(input: OrderFreightInput): number {
  const { freteConsumidor, freteSeller } = normalizeOrderFreight(input);
  return roundMoney(freteConsumidor + freteSeller);
}

export type QuantidadeSaldo = number & { readonly __brand: "QuantidadeSaldo" };

export function quantidadeSaldo(value: number): QuantidadeSaldo {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Quantidade de saldo inválida: ${value}`);
  }
  return value as QuantidadeSaldo;
}

export function somarSaldo(a: QuantidadeSaldo, b: QuantidadeSaldo): QuantidadeSaldo {
  return quantidadeSaldo(a + b);
}

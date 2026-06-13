/** Arredondamento comercial em 2 casas — espelha tax-engine / nfe-xml-blocks. */
export function roundMoney(value: number): number {
  return Number((value + Number.EPSILON).toFixed(2));
}

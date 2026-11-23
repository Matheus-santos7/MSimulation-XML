/**
 * Arredondamento comercial em 2 casas, meio-para-cima no valor decimal (TAX-2): 10,075 → 10,08.
 *
 * `toFixed` arredonda o binário (10,075 é 10,07499… em double) e errava ~48% dos empates. A
 * notação exponencial desloca a vírgula no texto decimal (`"10.075e2"` = 1007,5 exato) antes do
 * `Math.round`. Negativos arredondam pelo módulo (meio para longe do zero).
 */
export function roundMoney(value: number): number {
  const abs = Math.abs(value);
  const text = String(abs);
  // shortcut: número que o String() já escreve em notação exponencial (< 1e-6 ou ≥ 1e21) não
  // tem empate na 2ª casa; arredonda direto.
  const rounded = text.includes("e")
    ? Math.round(abs * 100) / 100
    : Math.round(Number(`${text}e2`)) / 100;

  return rounded === 0 ? 0 : Math.sign(value) * rounded;
}

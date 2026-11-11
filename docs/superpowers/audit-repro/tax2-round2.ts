/**
 * TAX-2: round2 (Number((v + EPSILON).toFixed(2))) contra arredondamento meio-para-cima exato.
 * Valores v = n/1000 com n terminando em 5 (o caso de empate), n de 5 a 999.995.
 * Referência exata em inteiros: floor((n + 5) / 10) / 100.
 */
import { calcularNotaFiscal, round2 } from "../../../backend/src/modules/tax/tax-calculation/tax-engine.js";

let total = 0;
let diverge = 0;
const exemplos: string[] = [];
for (let n = 5; n < 1_000_000; n += 10) {
  total++;
  const got = round2(n / 1000);
  const want = Math.floor((n + 5) / 10) / 100;
  if (got !== want) {
    diverge++;
    if (exemplos.length < 5) exemplos.push(`${n / 1000}→${got} (certo ${want})`);
  }
}
console.log(`empates testados: ${total}; divergências: ${diverge} (${((diverge / total) * 100).toFixed(1)}%); primeiros: ${exemplos.join(", ")}`);
console.log(`10.075 → ${round2(10.075)}`);

const item = (numeroItem: number, valorUnitario: number) => ({
  numeroItem, codigo: `P${numeroItem}`, descricao: "Item", ncm: "61091000", cfop: "5102", unidade: "UN",
  quantidade: 1, valorUnitario,
  icms: { cst: "00", orig: 0, pICMS: 18 },
  pis: { cst: "01", aliquota: 1.65 },
  cofins: { cst: "01", aliquota: 7.6 },
});
const nota = calcularNotaFiscal([item(1, 10.075), item(2, 4.015), item(3, 100.285)]);
const vProdCerto = 10.08 + 4.02 + 100.29;
console.log(`nota com 3 itens (10,075 + 4,015 + 100,285): vProd=${nota.totais.vProd}, certo=${vProdCerto.toFixed(2)}, diferença=${Math.round((vProdCerto - nota.totais.vProd) * 100)} centavo(s); vNF=${nota.totais.vNF}`);
console.log(`VEREDITO: ${diverge > 0 ? "Confirmado" : "Refutado"}`);

import assert from "node:assert/strict";
import { test } from "node:test";
import { roundMoney } from "./venda-ml-round.js";

test("roundMoney arredonda todo empate na 2ª casa para cima (TAX-2)", () => {
  // Empates n/1000 com n terminado em 5; referência exata em inteiros.
  for (let n = 5; n < 1_000_000; n += 10) {
    assert.equal(roundMoney(n / 1000), Math.floor((n + 5) / 10) / 100, `${n / 1000}`);
  }
});

test("roundMoney cobre casos de borda", () => {
  assert.equal(roundMoney(10.075), 10.08);
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(4.014), 4.01);
  assert.equal(roundMoney(-1.005), -1.01);
  assert.equal(roundMoney(-0.001), 0);
  assert.equal(roundMoney(0), 0);
  assert.equal(roundMoney(1e-7), 0);
  assert.equal(roundMoney(123456789.125), 123456789.13);
});

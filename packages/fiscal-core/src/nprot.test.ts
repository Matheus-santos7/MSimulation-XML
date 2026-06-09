import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ensureNProt,
  gerarProtocoloSefazSimulado,
  isValidNProt,
  simulationNProt,
} from "./nprot.js";

test("simulationNProt gera exatamente 15 dígitos", () => {
  assert.equal(simulationNProt(1), "135260000099001");
  assert.equal(simulationNProt(1).length, 15);
  assert.ok(isValidNProt(simulationNProt(1)));
  assert.equal(simulationNProt(42, "333260367974"), "333260367974042");
});

test("ensureNProt corrige protocolo com 13 dígitos", () => {
  assert.equal(ensureNProt("1352600000991", 1), "135260000099001");
  assert.ok(isValidNProt(ensureNProt("1352600000991", 1)));
});

test("gerarProtocoloSefazSimulado retorna 15 dígitos", () => {
  const p = gerarProtocoloSefazSimulado("41");
  assert.equal(p.length, 15);
  assert.ok(isValidNProt(p));
});

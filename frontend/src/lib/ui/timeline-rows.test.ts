import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TimelineChainDto, TimelineRemessaGroupDto } from "@/lib/fiscal-types";
import { flattenScenarioRows } from "./timeline-rows.js";

function chain(partial: Partial<TimelineChainDto> & Pick<TimelineChainDto, "id">): TimelineChainDto {
  return {
    emitidaEm: "2026-01-01T00:00:00.000Z",
    status: "completa",
    steps: [],
    ...partial,
  };
}

function group(
  partial: Partial<TimelineRemessaGroupDto> & Pick<TimelineRemessaGroupDto, "remessaChave" | "cenarios">,
): TimelineRemessaGroupDto {
  return {
    emitidaEm: "2026-01-01T00:00:00.000Z",
    remessaNumero: 155,
    remessaSerie: 58,
    quantidadeRemessa: 1,
    saldoDisponivel: 0,
    ...partial,
  };
}

describe("flattenScenarioRows", () => {
  it("marca remessa sem cenários com cenario null", () => {
    const rows = flattenScenarioRows([
      group({ remessaChave: "chave-155", cenarios: [] }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.cenario, null);
    assert.equal(rows[0]?.index, 0);
    assert.equal(rows[0]?.remessaNumeroSerie, "155/58");
    assert.equal(rows[0]?.saldoLabel, "saldo 0");
  });

  it("expande N cenários com número/série e saldo", () => {
    const rows = flattenScenarioRows([
      group({
        remessaChave: "chave-160",
        remessaNumero: 160,
        remessaSerie: 58,
        quantidadeRemessa: 100,
        saldoDisponivel: 99,
        cenarios: [chain({ id: "c1", status: "completa" }), chain({ id: "c2", status: "cancelada" })],
      }),
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.key, "c1");
    assert.equal(rows[0]?.index, 1);
    assert.equal(rows[0]?.cenario?.status, "completa");
    assert.equal(rows[1]?.key, "c2");
    assert.equal(rows[1]?.index, 2);
    assert.equal(rows[0]?.remessaNumeroSerie, "160/58");
    assert.equal(rows[0]?.saldoLabel, "saldo 99");
  });

  it("usa Vendas avulsas quando remessaChave está vazia", () => {
    const rows = flattenScenarioRows([
      group({
        remessaChave: "",
        cenarios: [chain({ id: "avulsa-1" })],
      }),
    ]);
    assert.equal(rows[0]?.remessaNumeroSerie, "Vendas avulsas");
    assert.equal(rows[0]?.saldoLabel, undefined);
  });

  it("numera cenários de forma contínua entre remessas (Cenário 1, 2, …)", () => {
    const rows = flattenScenarioRows([
      group({
        remessaChave: "a",
        remessaNumero: 1,
        cenarios: [chain({ id: "a1" })],
      }),
      group({
        remessaChave: "b",
        remessaNumero: 2,
        cenarios: [chain({ id: "b1" }), chain({ id: "b2" })],
      }),
    ]);
    assert.deepEqual(
      rows.map((r) => r.index),
      [1, 2, 3],
    );
  });
});

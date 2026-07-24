import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isInboundPositiveDifferenceNfe } from "./inbound-conference-payload.js";
import {
  allocateDebitAcrossSources,
  assertDebitFullyAllocated,
  assertPedidoMlForConference,
  ConferenceInsufficientBalanceError,
  sumLogicalConferenceQty,
} from "./inbound-conference-balance.js";
import { computeConferenceDeltas } from "./inbound-conference-delta.js";

describe("inbound-conference-balance (integração lógica FIFO)", () => {
  it("expected = pai + filhas POSITIVE; ignora remessa referenciada sem mlProcess", () => {
    const parentBalance = 8;
    const referenced = [
      {
        id: "pos-1",
        quantidade: 2,
        tipo: "REMESSA",
        fiscalPayload: { mlProcess: "INBOUND_POSITIVE_DIFFERENCE" },
        balance: 2,
      },
      {
        id: "avanco",
        quantidade: 5,
        tipo: "REMESSA",
        fiscalPayload: { engine: {} },
        balance: 5,
      },
    ];
    const positive = referenced.filter(isInboundPositiveDifferenceNfe);
    const expected = sumLogicalConferenceQty(
      parentBalance,
      positive.map((c) => c.balance),
    );
    assert.equal(expected, 10);
  });

  it("noop na reconferência quando received === expected (pai + sobra)", () => {
    const expectedQty = sumLogicalConferenceQty(7, [3]);
    const plan = computeConferenceDeltas([
      { lineId: "pai", expectedQty, receivedQty: 10 },
    ]);
    assert.equal(plan.hasDifferences, false);
    assert.equal(plan.negative.length, 0);
    assert.equal(plan.positive.length, 0);
  });

  it("débito NEGATIVE: esgota pai e depois filha POSITIVE", () => {
    const { allocations, remaining } = allocateDebitAcrossSources(5, [
      { id: "pai", balance: 3 },
      { id: "pos", balance: 4 },
    ]);
    assert.deepEqual(allocations, [
      { id: "pai", qty: 3 },
      { id: "pos", qty: 2 },
    ]);
    assert.equal(remaining, 0);
    assertDebitFullyAllocated(5, remaining);
  });

  it("falha de saldo quando débito excede pai + filhas POSITIVE", () => {
    const { remaining } = allocateDebitAcrossSources(10, [
      { id: "pai", balance: 3 },
      { id: "pos", balance: 2 },
    ]);
    assert.equal(remaining, 5);
    assert.throws(
      () => assertDebitFullyAllocated(10, remaining),
      (err: unknown) =>
        err instanceof ConferenceInsufficientBalanceError &&
        err.missing === 5 &&
        err.requested === 10,
    );
  });

  it("pedidoMl vazio é rejeitado (xTexto obrigatório)", () => {
    assert.throws(() => assertPedidoMlForConference(null));
    assert.throws(() => assertPedidoMlForConference("  "));
    assert.doesNotThrow(() => assertPedidoMlForConference("2000001234567890"));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarLinhaSaldoFifo } from "../entities/linha-saldo-fifo.js";
import { SaldoFifoInsuficienteError } from "../errors.js";
import { TransferidorSaldoFifo } from "./transferidor-saldo-fifo.js";

describe("TransferidorSaldoFifo", () => {
  const transferidor = new TransferidorSaldoFifo();

  it("debita em ordem FIFO (mais antiga primeiro)", () => {
    const linhas = [
      criarLinhaSaldoFifo({
        id: "item-novo",
        tenantId: "t1",
        productId: "p1",
        remessaNfeId: "nfe-novo",
        unidadeDestinoId: "cd-sp",
        saldoDisponivel: 5,
        emitidaEm: new Date("2026-02-01"),
      }),
      criarLinhaSaldoFifo({
        id: "item-antigo",
        tenantId: "t1",
        productId: "p1",
        remessaNfeId: "nfe-antigo",
        unidadeDestinoId: "cd-sp",
        saldoDisponivel: 3,
        emitidaEm: new Date("2026-01-01"),
      }),
    ];

    const { alocacoes } = transferidor.debitar(linhas, 4, "cd-sp");

    assert.equal(alocacoes.length, 2);
    assert.equal(alocacoes[0]!.nfeItemId, "item-antigo");
    assert.equal(alocacoes[0]!.quantidade, 3);
    assert.equal(alocacoes[1]!.nfeItemId, "item-novo");
    assert.equal(alocacoes[1]!.quantidade, 1);
  });

  it("rejeita débito maior que saldo disponível", () => {
    const linhas = [
      criarLinhaSaldoFifo({
        id: "item-1",
        tenantId: "t1",
        productId: "p1",
        remessaNfeId: "nfe-1",
        unidadeDestinoId: "cd-sp",
        saldoDisponivel: 2,
        emitidaEm: new Date("2026-01-01"),
      }),
    ];

    assert.throws(
      () => transferidor.debitar(linhas, 3, "cd-sp"),
      SaldoFifoInsuficienteError,
    );
  });
});

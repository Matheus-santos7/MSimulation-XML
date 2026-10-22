import assert from "node:assert/strict";
import type { ArgumentsHost } from "@nestjs/common";
import { describe, it } from "vitest";
import { MarketplaceNotConfiguredError } from "@msimulation-xml/fiscal-core";
import { LogisticsUnitError } from "../../logistics/index.js";
import { RemessaDomainError } from "../errors/remessas.errors.js";
import { RemessasErrorFilter } from "../errors/remessas-error.filter.js";
import { SaldoRemessaInsuficienteError } from "../stock-fifo/queries/remessa-fifo.errors.js";

type Sent = { status?: number; body?: unknown };

function handle(exception: unknown): Sent {
  const sent: Sent = {};
  const reply = {
    sent: false,
    status(code: number) {
      sent.status = code;
      return this;
    },
    send(body: unknown) {
      sent.body = body;
      return this;
    },
  };
  const log = { error: () => undefined, warn: () => undefined };
  const host = {
    switchToHttp: () => ({ getRequest: () => ({ log }), getResponse: () => reply }),
  } as unknown as ArgumentsHost;

  new RemessasErrorFilter().catch(exception, host);

  return sent;
}

describe("RemessasErrorFilter", () => {
  it("should answer 400 with the message for emission domain errors", () => {
    const domain = handle(new RemessaDomainError("Sem saldo no CD"));
    const fifo = handle(new SaldoRemessaInsuficienteError("p-1", 3, 1));
    const unit = handle(new LogisticsUnitError("Unidade logística de destino não encontrada"));

    assert.deepEqual(domain, { status: 400, body: { error: "Sem saldo no CD" } });
    assert.equal(fifo.status, 400);
    assert.equal(unit.status, 400);
  });

  it("should answer 503 with guidance when the interactive transaction times out (P2028)", () => {
    const sent = handle(Object.assign(new Error("Transaction timeout"), { code: "P2028" }));

    assert.equal(sent.status, 503);
    assert.match((sent.body as { error: string }).error, /^A emissão demorou mais que o esperado/);
  });

  it("should answer 422 when the destination marketplace has no fiscal profile yet", () => {
    const sent = handle(new MarketplaceNotConfiguredError("SHOPEE"));

    assert.deepEqual(sent, {
      status: 422,
      body: { error: "Marketplace ainda não configurado para faturamento" },
    });
  });

  it("should fall back to the generic 500 for unknown errors", () => {
    const sent = handle(new Error("falha inesperada"));

    assert.equal(sent.status, 500);
  });
});

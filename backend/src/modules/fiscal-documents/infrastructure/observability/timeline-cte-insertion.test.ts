import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FiscalStatus, NFeTipo } from "../../../../generated/prisma/client.js";
import { insertCteStepsIntoChain } from "./timeline-cte-insertion.js";
import type { TimelineChainStepDto } from "./timeline-step.dto.js";

describe("insertCteStepsIntoChain", () => {
  const nfeChaveToId = new Map([
    ["ch-rem", "id-rem"],
    ["ch-venda", "id-venda"],
  ]);

  const baseSteps: TimelineChainStepDto[] = [
    {
      kind: "nfe",
      tipo: NFeTipo.REMESSA,
      tipoLabel: "Remessa",
      chave: "ch-rem",
      numero: 160,
      serie: 58,
      emitidaEm: "2026-01-01T10:00:00.000Z",
      quantidade: 10,
      status: FiscalStatus.AUTORIZADA,
    },
    {
      kind: "nfe",
      tipo: NFeTipo.RETORNO_SIMBOLICO,
      tipoLabel: "Retorno simbólico",
      chave: "ch-ret",
      numero: 161,
      serie: 58,
      emitidaEm: "2026-01-01T11:00:00.000Z",
      quantidade: 1,
      status: FiscalStatus.AUTORIZADA,
    },
    {
      kind: "nfe",
      tipo: NFeTipo.VENDA,
      tipoLabel: "Venda",
      chave: "ch-venda",
      numero: 162,
      serie: 58,
      emitidaEm: "2026-01-02T10:00:00.000Z",
      quantidade: 1,
      status: FiscalStatus.AUTORIZADA,
    },
  ];

  it("insere CT-e de remessa após o passo REMESSA", () => {
    const steps = insertCteStepsIntoChain(
      baseSteps,
      [
        {
          id: "cte-1",
          chave: "ch-cte-rem",
          numero: 1,
          serie: 1,
          emitidoEm: new Date("2026-01-01T10:30:00.000Z"),
          status: FiscalStatus.AUTORIZADA,
          nfeRemessaId: "id-rem",
          nfeVendaId: null,
        },
      ],
      nfeChaveToId,
    );

    assert.deepEqual(
      steps.map((s) =>
        s.kind === "nfe" ? `nfe:${s.tipo}` : s.kind === "cte" ? `cte:${s.numero}` : `evt`,
      ),
      ["nfe:REMESSA", "cte:1", "nfe:RETORNO_SIMBOLICO", "nfe:VENDA"],
    );
  });

  it("insere CT-e de venda após o passo VENDA", () => {
    const steps = insertCteStepsIntoChain(
      baseSteps,
      [
        {
          id: "cte-v",
          chave: "ch-cte-venda",
          numero: 9,
          serie: 1,
          emitidoEm: new Date("2026-01-02T10:30:00.000Z"),
          status: FiscalStatus.AUTORIZADA,
          nfeRemessaId: null,
          nfeVendaId: "id-venda",
        },
      ],
      nfeChaveToId,
    );

    assert.deepEqual(
      steps.map((s) =>
        s.kind === "nfe" ? `nfe:${s.tipo}` : s.kind === "cte" ? `cte:${s.numero}` : `evt`,
      ),
      ["nfe:REMESSA", "nfe:RETORNO_SIMBOLICO", "nfe:VENDA", "cte:9"],
    );
  });

  it("não altera a cadeia quando não há CT-e vinculado", () => {
    const steps = insertCteStepsIntoChain(baseSteps, [], nfeChaveToId);
    assert.equal(steps.length, 3);
    assert.ok(steps.every((s) => s.kind === "nfe"));
  });
});

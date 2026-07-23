import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FiscalStatus, NFeTipo } from "../../../../generated/prisma/client.js";
import { enrichScenarioStepsWithEvents } from "./timeline-chain-enrichment.js";
import type { TimelineNfeStepDto } from "./timeline-step.dto.js";

function nfeStep(
  overrides: Partial<TimelineNfeStepDto> & Pick<TimelineNfeStepDto, "tipo" | "chave" | "numero" | "serie">,
): TimelineNfeStepDto {
  return {
    kind: "nfe",
    tipoLabel: overrides.tipo,
    emitidaEm: "2026-01-01T00:00:00.000Z",
    quantidade: 1,
    status: FiscalStatus.AUTORIZADA,
    ...overrides,
  };
}

describe("enrichScenarioStepsWithEvents", () => {
  const baseSteps: TimelineNfeStepDto[] = [
    nfeStep({ tipo: NFeTipo.REMESSA, chave: "r1", numero: 8, serie: 58 }),
    nfeStep({ tipo: NFeTipo.RETORNO_SIMBOLICO, chave: "ret1", numero: 9, serie: 58 }),
    nfeStep({ tipo: NFeTipo.VENDA, chave: "v1", numero: 14, serie: 58 }),
  ];

  it("insere inutilização em lacuna sequencial entre notas do cenário", () => {
    const steps = enrichScenarioStepsWithEvents(
      baseSteps,
      [
        {
          id: "inut-1",
          serie: 58,
          numeroIni: 11,
          numeroFim: 12,
          ocorridoEm: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
      new Map(),
    );

    assert.deepEqual(
      steps.map((s) => (s.kind === "nfe" ? `nfe:${s.numero}` : `evt:${s.eventTipo}:${s.numero}`)),
      ["nfe:8", "nfe:9", "evt:INUT:11", "nfe:14"],
    );
  });

  it("insere inutilização anterior ao primeiro número do cenário", () => {
    const steps = enrichScenarioStepsWithEvents(
      baseSteps,
      [
        {
          id: "inut-prior",
          serie: 58,
          numeroIni: 1,
          numeroFim: 3,
          ocorridoEm: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      new Map(),
    );

    assert.equal(steps[0]?.kind, "event");
    assert.equal((steps[0] as { eventTipo: string }).eventTipo, "INUT");
    assert.equal(steps[1]?.kind, "nfe");
    assert.equal((steps[1] as { numero: number }).numero, 8);
  });

  it("anexa cancelamento após venda e retorno simbólico", () => {
    const cancelledSteps: TimelineNfeStepDto[] = [
      nfeStep({
        tipo: NFeTipo.RETORNO_SIMBOLICO,
        chave: "ret1",
        numero: 9,
        serie: 58,
        status: FiscalStatus.CANCELADA,
      }),
      nfeStep({
        tipo: NFeTipo.VENDA,
        chave: "v1",
        numero: 14,
        serie: 58,
        status: FiscalStatus.CANCELADA,
      }),
    ];

    const cancellations = new Map([
      ["ret1", { id: "evt-ret", chave: "ret1", ocorridoEm: new Date("2026-01-03T00:00:00.000Z") }],
      ["v1", { id: "evt-venda", chave: "v1", ocorridoEm: new Date("2026-01-03T00:00:00.000Z") }],
    ]);

    const steps = enrichScenarioStepsWithEvents(cancelledSteps, [], cancellations);

    assert.equal(steps.length, 4);
    assert.equal(steps[0]?.kind, "nfe");
    assert.equal((steps[1] as { eventTipo: string }).eventTipo, "110111");
    assert.equal((steps[3] as { chaveRef?: string }).chaveRef, "v1");
  });

  it("ignora inutilização de outra série", () => {
    const steps = enrichScenarioStepsWithEvents(
      baseSteps,
      [
        {
          id: "inut-other",
          serie: 99,
          numeroIni: 1,
          numeroFim: 5,
          ocorridoEm: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      new Map(),
    );

    assert.equal(steps.length, 3);
    assert.ok(steps.every((s) => s.kind === "nfe"));
  });

  it("não repete inutilização em número já ocupado por NF-e do cenário", () => {
    // Bug: retorno 163 + venda 164 não devem aparecer também como INUT 163/164.
    const steps = enrichScenarioStepsWithEvents(
      [
        nfeStep({ tipo: NFeTipo.REMESSA, chave: "r160", numero: 160, serie: 58 }),
        nfeStep({ tipo: NFeTipo.RETORNO_SIMBOLICO, chave: "ret163", numero: 163, serie: 58 }),
        nfeStep({ tipo: NFeTipo.VENDA, chave: "v164", numero: 164, serie: 58 }),
      ],
      [
        {
          id: "inut-163",
          serie: 58,
          numeroIni: 163,
          numeroFim: 163,
          ocorridoEm: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "inut-164",
          serie: 58,
          numeroIni: 164,
          numeroFim: 164,
          ocorridoEm: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "inut-gap",
          serie: 58,
          numeroIni: 161,
          numeroFim: 162,
          ocorridoEm: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
      new Map(),
    );

    assert.deepEqual(
      steps.map((s) => (s.kind === "nfe" ? `nfe:${s.numero}` : `evt:${s.eventTipo}:${s.numero}`)),
      ["nfe:160", "evt:INUT:161", "nfe:163", "nfe:164"],
    );
  });

  it("recorta faixa inutilizada removendo números já emitidos no cenário", () => {
    const steps = enrichScenarioStepsWithEvents(
      [
        nfeStep({ tipo: NFeTipo.REMESSA, chave: "r1", numero: 10, serie: 1 }),
        nfeStep({ tipo: NFeTipo.VENDA, chave: "v1", numero: 12, serie: 1 }),
      ],
      [
        {
          id: "inut-wide",
          serie: 1,
          numeroIni: 10,
          numeroFim: 13,
          ocorridoEm: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
      new Map(),
    );

    // 10 e 12 ocupados → restam 11 e 13 como faixas (podem ser um ou dois eventos)
    const events = steps.filter((s) => s.kind === "event");
    assert.ok(events.length >= 1);
    assert.ok(
      steps.every((s) => {
        if (s.kind !== "event") return true;
        const fim = s.numeroFim ?? s.numero;
        return !(s.numero <= 10 && fim >= 10) && !(s.numero <= 12 && fim >= 12);
      }),
      "nenhum evento INUT deve cobrir número de NF-e do cenário",
    );
    assert.ok(steps.some((s) => s.kind === "nfe" && s.numero === 10));
    assert.ok(steps.some((s) => s.kind === "nfe" && s.numero === 12));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ValidationInsightsUseCase } from "../use-cases/validation-insights.usecase.js";
import type { ValidationInsightsRepository } from "../validation-insights.repository.js";

function rejected(chave: string, errosValidacao: unknown) {
  return {
    id: chave,
    chave,
    numero: 1,
    serie: 1,
    cfop: "5102",
    tipo: "VENDA",
    mensagemValidacao: null,
    errosValidacao,
    emitidaEm: new Date("2026-10-20T12:00:00.000Z"),
  };
}

describe("ValidationInsightsUseCase", () => {
  it("should rank the most frequent validation errors of the last 7 days", async () => {
    const repository = {
      countValidationStatuses: async () => ({
        approved: 3,
        rejected: 2,
        pending: 0,
        pendingAllTime: 1,
      }),
      listRecentRejectedNfes: async () => [
        rejected("k1", ["CST inválido", "NCM inválido"]),
        rejected("k2", ["CST inválido"]),
        rejected("k3", "formato antigo"),
      ],
    } as unknown as ValidationInsightsRepository;

    const insights = await new ValidationInsightsUseCase(repository).execute("tenant-01");

    assert.equal(insights.periodDays, 7);
    assert.deepEqual(insights.topErrors, [
      { message: "CST inválido", count: 2 },
      { message: "NCM inválido", count: 1 },
    ]);
    assert.deepEqual(insights.recentRejections[2]!.errors, []);
    assert.equal(insights.recentRejections[0]!.emitidaEm, "2026-10-20T12:00:00.000Z");
  });
});

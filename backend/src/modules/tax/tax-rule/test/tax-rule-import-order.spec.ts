/**
 * Prova que o import de planilha lê e interpreta o arquivo ANTES de abrir a transação:
 * só o `bulkUpsert` roda dentro de `runWithDbContext`. Se alguém mover o parse para dentro
 * da transação, a ordem registrada aqui muda e o teste falha.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { getDbRequestContext } from "../../../../lib/db/tenant-rls.js";
import { TaxRuleError } from "../../errors/tax.errors.js";
import type { TaxRuleRepository } from "../tax-rule.repository.js";
import { TaxRuleService } from "../tax-rule.service.js";

const calls: string[] = [];

vi.mock("../spreadsheet/tax-rule-spreadsheet.parser.js", () => ({
  parseTaxRuleSpreadsheet: vi.fn(() => {
    calls.push("parse");

    return { rawRows: [{ ruleId: "1" }], errors: [{ line: 5, message: "Linha ignorada" }] };
  }),
}));

vi.mock("../spreadsheet/tax-rule-spreadsheet.mapper.js", () => ({
  mapTaxRuleSpreadsheetRows: vi.fn(() => {
    calls.push("map");

    return { rows: [{ ruleId: "1-SP" }], errors: [] };
  }),
}));

const TENANT_ID = "tenant-1";
const USER_ID = "user-1";

function buildService(mappedRowsEmpty = false) {
  const tx = { $executeRaw: vi.fn() };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      calls.push("transaction:open");
      const result = await fn(tx);
      calls.push("transaction:commit");

      return result;
    }),
  } as unknown as PrismaClient;
  const repository = {
    bulkUpsert: vi.fn(async () => {
      calls.push(`bulkUpsert:${getDbRequestContext()?.tenantId}:${getDbRequestContext()?.userId}`);

      return { created: 1, updated: 0, total: 1 };
    }),
  } as unknown as TaxRuleRepository;

  if (mappedRowsEmpty) {
    vi.mocked(repository.bulkUpsert).mockRejectedValue(new Error("não deveria gravar"));
  }

  return { service: new TaxRuleService(repository, prisma), prisma, repository };
}

describe("TaxRuleService.importSpreadsheet", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("faz parse e map antes de abrir a transação e grava só dentro dela", async () => {
    // Arrange
    const { service } = buildService();

    // Act
    await service.importSpreadsheet(TENANT_ID, USER_ID, Buffer.from("x"));

    // Assert
    expect(calls).toEqual([
      "parse",
      "map",
      "transaction:open",
      `bulkUpsert:${TENANT_ID}:${USER_ID}`,
      "transaction:commit",
    ]);
  });

  it("repassa os parseErrors junto com o resultado do upsert", async () => {
    // Arrange
    const { service } = buildService();

    // Act
    const result = await service.importSpreadsheet(TENANT_ID, USER_ID, Buffer.from("x"));

    // Assert
    expect(result).toEqual({
      created: 1,
      updated: 0,
      total: 1,
      parseErrors: [{ line: 5, message: "Linha ignorada" }],
    });
  });

  it("não abre transação quando a planilha não tem regra válida", async () => {
    // Arrange
    const { mapTaxRuleSpreadsheetRows } = await import(
      "../spreadsheet/tax-rule-spreadsheet.mapper.js"
    );
    vi.mocked(mapTaxRuleSpreadsheetRows).mockReturnValueOnce({
      rows: [],
      errors: [{ line: 4, message: "Coluna ORIGIN vazia" }],
    });
    const { service, prisma } = buildService(true);

    // Act
    const promise = service.importSpreadsheet(TENANT_ID, USER_ID, Buffer.from("x"));

    // Assert
    await expect(promise).rejects.toBeInstanceOf(TaxRuleError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

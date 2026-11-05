import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbTransactionContext, type PrismaTransactionClient } from "../../../../lib/db/tenant-rls.js";
import { TaxRuleRepository } from "../tax-rule.repository.js";
import type { TaxRuleImportRow } from "../types/tax-rule-import-row.types.js";

const TENANT_ID = "tenant-01";

function importRow(index: number, nome = `Regra ${index}`): TaxRuleImportRow {
  return {
    ruleId: `R${index}-SP-taxpayer-sale`,
    nome,
    tipo: "ICMS",
    uf: "SP",
    cfop: "5102",
    aliquota: "18",
    origin: "SP",
    payload: { index },
  };
}

describe("TaxRuleRepository", () => {
  let findMany: ReturnType<typeof vi.fn>;
  let executeRaw: ReturnType<typeof vi.fn>;
  let fakeTx: PrismaTransactionClient;
  let repository: TaxRuleRepository;

  beforeEach(() => {
    findMany = vi.fn();
    executeRaw = vi.fn().mockResolvedValue(0);
    fakeTx = { taxRule: { findMany }, $executeRaw: executeRaw } as unknown as PrismaTransactionClient;
    repository = new TaxRuleRepository();
  });

  function bulkUpsert(rows: TaxRuleImportRow[]) {
    return dbTransactionContext.run(fakeTx, () => repository.bulkUpsert(TENANT_ID, rows));
  }

  it("should count created and updated rules with at most 3 database calls", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => importRow(i));
    findMany.mockResolvedValue(rows.slice(0, 10).map((row) => ({ ruleId: row.ruleId })));

    const result = await bulkUpsert(rows);

    expect(result).toEqual({ created: 15, updated: 10, total: 25 });
    expect(findMany.mock.calls.length + executeRaw.mock.calls.length).toBeLessThanOrEqual(3);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
    );
  });

  it("should keep only the last row of a duplicated ruleId", async () => {
    findMany.mockResolvedValue([]);
    const rows = [importRow(1, "Primeira"), importRow(2), importRow(1, "Última")];

    const result = await bulkUpsert(rows);

    expect(result).toEqual({ created: 2, updated: 0, total: 2 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const values = executeRaw.mock.calls[0]!.slice(1);
    expect(values).toContainEqual(["Última", "Regra 2"]);
    expect(values).toContainEqual([JSON.stringify({ index: 1 }), JSON.stringify({ index: 2 })]);
  });

  it("should split the write into batches of at most 500 rows", async () => {
    findMany.mockResolvedValue([]);
    const rows = Array.from({ length: 1001 }, (_, i) => importRow(i));

    const result = await bulkUpsert(rows);

    expect(result).toEqual({ created: 1001, updated: 0, total: 1001 });
    expect(executeRaw).toHaveBeenCalledTimes(3);
  });
});

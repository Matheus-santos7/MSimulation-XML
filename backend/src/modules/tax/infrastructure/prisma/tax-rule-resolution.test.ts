import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { resolveTaxRuleFromDb } from "./tax-rule-resolution.js";

function mockPrisma(rows: Record<string, unknown>[]) {
  return {
    taxRule: {
      findUnique: async ({ where }: { where: { tenantId_ruleId: { ruleId: string } } }) =>
        rows.find((r) => r.ruleId === where.tenantId_ruleId.ruleId) ?? null,
      findFirst: async ({
        where,
      }: {
        where: {
          ruleId?: { startsWith: string };
          transactionType?: string;
          customerType?: string;
          OR?: Array<{ uf?: string; origin?: { startsWith: string } }>;
        };
      }) => {
        return (
          rows.find((r) => {
            if (where.transactionType && r.transactionType !== where.transactionType) return false;
            if (where.customerType && r.customerType !== where.customerType) return false;
            if (where.ruleId?.startsWith) {
              const prefix = where.ruleId.startsWith;
              if (!String(r.ruleId).startsWith(prefix)) return false;
            }
            if (where.OR?.length) {
              const originUf = where.OR[0]?.uf ?? where.OR[1]?.origin?.startsWith;
              if (originUf && r.uf !== originUf && !String(r.origin ?? "").startsWith(String(originUf))) {
                return false;
              }
            }
            return true;
          }) ?? null
        );
      },
    },
  } as unknown as PrismaTx;
}

describe("resolveTaxRuleFromDb", () => {
  it("resolve venda não contribuinte SP→MG pelo ruleId com origem embutida", async () => {
    const prisma = mockPrisma([
      {
        ruleId: "4133250001-SP-non_taxpayer-sale",
        origin: "São Paulo",
        uf: "SP",
        cfop: "",
        transactionType: "sale",
        customerType: "non_taxpayer",
        payload: {
          icmsByUf: {
            ICMS_MG_PICMS_INTERNAL: 18,
            ICMS_MG_CST: "00 - Tributada integralmente",
          },
        },
      },
    ]);

    const resolved = await resolveTaxRuleFromDb(prisma, "tenant-1", {
      originUf: "SP",
      destinationUf: "MG",
      transactionType: "sale",
      customerType: "non_taxpayer",
      ruleBaseId: "4133250001",
    });

    assert.ok(resolved);
    assert.equal(resolved!.icms?.cst, "00");
    assert.equal(resolved!.icms?.pIcmsInternal, 18);
  });

  it("aceita linha legada quando uf está correto mesmo com origin textual", async () => {
    const prisma = mockPrisma([
      {
        ruleId: "4133250001-taxpayer-sale",
        origin: "São Paulo",
        uf: "SP",
        cfop: "",
        transactionType: "sale",
        customerType: "taxpayer",
        payload: { icmsByUf: { ICMS_MG_CST: "10 - ST" } },
      },
    ]);

    const resolved = await resolveTaxRuleFromDb(prisma, "tenant-1", {
      originUf: "SP",
      destinationUf: "MG",
      transactionType: "sale",
      customerType: "taxpayer",
      ruleBaseId: "4133250001",
    });

    assert.ok(resolved);
    assert.equal(resolved!.icms?.cst, "10");
  });
});

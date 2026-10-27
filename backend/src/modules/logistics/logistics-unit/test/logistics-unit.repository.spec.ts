import { describe, expect, it, vi } from "vitest";
import {
  dbTransactionContext,
  type PrismaTransactionClient,
} from "../../../../lib/db/tenant-rls.js";
import type { CepLookupProvider } from "../../../lookup/index.js";
import { LogisticsUnitRepository } from "../logistics-unit.repository.js";

const ROW = {
  unidade: "SP02 - Cajamar",
  cnpj: "03007331012239",
  inscricaoEstadual: "120519234116",
  logradouro: "Av. das Nações",
  numero: "3000",
  cidade: "Cajamar",
  uf: "sp",
  cep: "07750000",
};

function fakeDb(existing: { id: string; codigo: string } | null) {
  return {
    unidadeLogistica: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({ id: "unit-new" }),
      update: vi.fn().mockResolvedValue({}),
    },
    tenantUnidadeLogistica: { upsert: vi.fn() },
  };
}

function bulkImport(db: ReturnType<typeof fakeDb>) {
  const repository = new LogisticsUnitRepository({
    lookup: vi.fn(),
  } as unknown as CepLookupProvider);

  return dbTransactionContext.run(db as unknown as PrismaTransactionClient, () =>
    repository.bulkImport("tenant-1", "MERCADO_LIVRE", [ROW], false),
  );
}

describe("LogisticsUnitRepository.bulkImport", () => {
  it("should look up and create the CD inside the marketplace", async () => {
    // Arrange
    const db = fakeDb(null);

    // Act
    const result = await bulkImport(db);

    // Assert
    expect(db.unidadeLogistica.findUnique).toHaveBeenCalledWith({
      where: { marketplace_cnpj: { marketplace: "MERCADO_LIVRE", cnpj: "03007331012239" } },
    });
    expect(db.unidadeLogistica.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ marketplace: "MERCADO_LIVRE", codigo: "SP02", uf: "SP" }),
    });
    expect(db.tenantUnidadeLogistica.upsert).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ created: 1, updated: 0, unicos: 1 });
  });

  it("should update the CD that already exists in the marketplace", async () => {
    // Arrange
    const db = fakeDb({ id: "unit-1", codigo: "SP02" });

    // Act
    const result = await bulkImport(db);

    // Assert
    expect(db.unidadeLogistica.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "unit-1" } }),
    );
    expect(db.unidadeLogistica.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ created: 0, updated: 1 });
  });
});

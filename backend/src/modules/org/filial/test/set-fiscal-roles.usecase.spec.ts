import { describe, expect, it, vi } from "vitest";
import { OrgError } from "../../errors/org.errors.js";
import type { TenantRepository } from "../../tenant/tenant.repository.js";
import type { FilialRepository } from "../filial.repository.js";
import { SetFiscalRolesUseCase } from "../use-cases/set-fiscal-roles.usecase.js";

function makeUseCase(filialExists: boolean) {
  const tenants = {
    updateFiscalRoles: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    findByIdWithFiliais: vi.fn().mockResolvedValue({ id: "tenant-1", filiais: [] }),
  };
  const filiais = { findById: vi.fn().mockResolvedValue(filialExists ? { id: "filial-1" } : null) };
  const useCase = new SetFiscalRolesUseCase(
    tenants as unknown as TenantRepository,
    filiais as unknown as FilialRepository,
  );

  return { useCase, tenants, filiais };
}

describe("SetFiscalRolesUseCase", () => {
  it("should accept the matrix (null or own id) without looking up filiais", async () => {
    // Arrange
    const { useCase, filiais, tenants } = makeUseCase(false);

    // Act
    await useCase.execute("tenant-1", {
      emitenteRemessaId: null,
      emitenteTransferenciaId: "tenant-1",
    });

    // Assert
    expect(filiais.findById).not.toHaveBeenCalled();
    expect(tenants.updateFiscalRoles).toHaveBeenCalledOnce();
  });

  it("should return the tenant with filiais after saving a filial of the tenant", async () => {
    // Arrange
    const { useCase } = makeUseCase(true);

    // Act / Assert
    await expect(useCase.execute("tenant-1", { emitenteRemessaId: "filial-1" })).resolves.toEqual({
      id: "tenant-1",
      filiais: [],
    });
  });

  it("should refuse a filial of another tenant", async () => {
    // Arrange
    const { useCase, tenants } = makeUseCase(false);

    // Act / Assert
    await expect(useCase.execute("tenant-1", { emitenteRemessaId: "filial-9" })).rejects.toThrow(
      new OrgError.FilialInvalid("Estabelecimento emitente não pertence a esta empresa"),
    );
    expect(tenants.updateFiscalRoles).not.toHaveBeenCalled();
  });
});

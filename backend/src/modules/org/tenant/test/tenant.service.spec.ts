import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { TenantRepository } from "../tenant.repository.js";
import { TenantService } from "../tenant.service.js";

describe("TenantService", () => {
  const tenant = { id: "tenant-1", razaoSocial: "Empresa" };
  const repository = {
    findByIdWithFiliais: vi.fn().mockResolvedValue(tenant),
    update: vi.fn().mockResolvedValue(tenant),
  };
  const service = new TenantService(repository as unknown as TenantRepository);

  it("should list only the tenant of the JWT", async () => {
    // Act / Assert
    await expect(service.listOwn("tenant-1")).resolves.toEqual([tenant]);
  });

  it("should answer 404 for another tenant without reading it", async () => {
    // Arrange
    repository.findByIdWithFiliais.mockClear();

    // Act / Assert
    await expect(service.getOwn("tenant-2", "tenant-1")).rejects.toThrow(
      new NotFoundException("Empresa não encontrada"),
    );
    expect(repository.findByIdWithFiliais).not.toHaveBeenCalled();
  });

  it("should answer 404 when the tenant to update no longer exists", async () => {
    // Arrange
    repository.update.mockResolvedValue(null);

    // Act / Assert
    await expect(service.update("tenant-1", { razaoSocial: "Nova" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

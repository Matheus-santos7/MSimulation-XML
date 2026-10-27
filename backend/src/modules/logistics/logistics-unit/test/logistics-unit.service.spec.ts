import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { LogisticsUnitRepository } from "../logistics-unit.repository.js";
import { LogisticsUnitService } from "../logistics-unit.service.js";

describe("LogisticsUnitService", () => {
  it("should pass the marketplace filter to the repository", async () => {
    // Arrange
    const repository = { listByTenant: vi.fn().mockResolvedValue([]) };
    const service = new LogisticsUnitService(repository as unknown as LogisticsUnitRepository);

    // Act
    await service.list("tenant-1", { marketplace: "SHOPEE", ativa: true });

    // Assert
    expect(repository.listByTenant).toHaveBeenCalledWith("tenant-1", {
      marketplace: "SHOPEE",
      ativa: true,
    });
  });

  it("should answer 404 for an unknown unit", async () => {
    // Arrange
    const repository = { findByIdForTenant: vi.fn().mockResolvedValue(null) };
    const service = new LogisticsUnitService(repository as unknown as LogisticsUnitRepository);

    // Act / Assert
    await expect(service.get("tenant-1", "unit-9")).rejects.toThrow(
      new NotFoundException("Unidade não encontrada"),
    );
  });
});

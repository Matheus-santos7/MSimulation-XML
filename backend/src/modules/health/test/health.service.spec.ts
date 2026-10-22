import type { FastifyBaseLogger } from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { HealthService } from "../health.service.js";

function makeService(queryRaw: () => Promise<unknown>) {
  const prisma = { $queryRaw: vi.fn(queryRaw) } as unknown as PrismaClient;
  const logger = { error: vi.fn() } as unknown as FastifyBaseLogger;

  return { service: new HealthService(prisma, logger), logger };
}

describe("HealthService", () => {
  it("should report ok when the database answers", async () => {
    // Arrange
    const { service } = makeService(async () => [{ "?column?": 1 }]);

    // Act
    const health = await service.check();

    // Assert
    expect(health).toMatchObject({ status: "ok", service: "api", database: "ok" });
    expect(Number.isNaN(Date.parse(health.timestamp))).toBe(false);
  });

  it("should report degraded and log when the database fails", async () => {
    // Arrange
    const { service, logger } = makeService(async () => {
      throw new Error("ECONNREFUSED");
    });

    // Act
    const health = await service.check();

    // Assert
    expect(health).toMatchObject({ status: "degraded", database: "unavailable" });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

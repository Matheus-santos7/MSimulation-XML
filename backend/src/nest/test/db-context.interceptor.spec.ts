import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { lastValueFrom, of } from "rxjs";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { getDbClient } from "../../lib/db/tenant-rls.js";
import {
  DbContextInterceptor,
  PooledDbContext,
  SkipDbContext,
} from "../db/db-context.interceptor.js";

class SampleController {
  withTransaction() {}

  @SkipDbContext()
  withoutTransaction() {}

  @PooledDbContext()
  pooled() {}
}

function contextFor(handler: () => void): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId: "user-1", tenantId: "tenant-1" } }),
    }),
  } as unknown as ExecutionContext;
}

function buildInterceptor() {
  const tx = { $executeRaw: vi.fn() };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaClient;

  return { interceptor: new DbContextInterceptor(prisma, new Reflector()), prisma };
}

const next: CallHandler = { handle: () => of("ok") };

describe("DbContextInterceptor", () => {
  it("abre a transação para o handler sem @SkipDbContext", async () => {
    // Arrange
    const { interceptor, prisma } = buildInterceptor();

    // Act
    const result = await lastValueFrom(
      interceptor.intercept(contextFor(SampleController.prototype.withTransaction), next),
    );

    // Assert
    expect(result).toBe("ok");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("não abre transação para o handler com @SkipDbContext", async () => {
    // Arrange
    const { interceptor, prisma } = buildInterceptor();

    // Act
    const result = await lastValueFrom(
      interceptor.intercept(contextFor(SampleController.prototype.withoutTransaction), next),
    );

    // Assert
    expect(result).toBe("ok");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("usa o client raiz sem transação para o handler com @PooledDbContext", async () => {
    // Arrange
    const { interceptor, prisma } = buildInterceptor();
    const seen: CallHandler = { handle: () => of(getDbClient()) };

    // Act
    const client = await lastValueFrom(
      interceptor.intercept(contextFor(SampleController.prototype.pooled), seen),
    );

    // Assert
    expect(client).toBe(prisma);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

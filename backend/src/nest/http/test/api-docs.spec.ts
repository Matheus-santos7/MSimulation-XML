import { afterEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { buildApp } from "../../../app.js";

process.env.JWT_SECRET ??= "api-docs-spec-secret-0123456789";

const fakePrisma = new Proxy(
  {},
  { get: () => () => Promise.resolve(null) },
) as unknown as PrismaClient;

describe("setupApiDocs", () => {
  afterEach(() => {
    delete process.env.API_DOCS_ENABLED;
  });

  it("should not expose /api/docs by default", async () => {
    // Arrange
    const app = await buildApp({ logger: false, prisma: fakePrisma });

    try {
      // Act
      const response = await app
        .getHttpAdapter()
        .getInstance()
        .inject({ method: "GET", url: "/api/docs-json" });

      // Assert
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("should serve the OpenAPI document when API_DOCS_ENABLED=true", async () => {
    // Arrange
    process.env.API_DOCS_ENABLED = "true";
    const app = await buildApp({ logger: false, prisma: fakePrisma });

    try {
      // Act
      const response = await app
        .getHttpAdapter()
        .getInstance()
        .inject({ method: "GET", url: "/api/docs-json" });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json().paths).toHaveProperty("/api/health");
    } finally {
      await app.close();
    }
  });
});

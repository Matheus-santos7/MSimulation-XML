import { afterEach, describe, expect, it } from "vitest";
import { ConfigService } from "../config.service.js";

describe("ConfigService", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("should read the environment at access time", () => {
    // Arrange
    const config = new ConfigService();
    process.env.PORT = "4000";

    // Act
    const first = config.port;
    process.env.PORT = "5000";

    // Assert
    expect(first).toBe("4000");
    expect(config.port).toBe("5000");
  });

  it("should report production only when NODE_ENV is production", () => {
    // Arrange
    const config = new ConfigService();

    // Act
    process.env.NODE_ENV = "development";
    const development = config.isProduction;
    process.env.NODE_ENV = "production";

    // Assert
    expect(development).toBe(false);
    expect(config.isProduction).toBe(true);
  });

  it("should default dbPoolMax to 10 when DB_POOL_MAX is not set", () => {
    // Arrange
    const config = new ConfigService();
    delete process.env.DB_POOL_MAX;

    // Act / Assert
    expect(config.dbPoolMax).toBe(10);
  });

  it("should read DB_POOL_MAX as an integer", () => {
    // Arrange
    const config = new ConfigService();
    process.env.DB_POOL_MAX = "20";

    // Act / Assert
    expect(config.dbPoolMax).toBe(20);
  });

  it.each(["0", "-1", "2.5", "abc"])("should reject DB_POOL_MAX=%s", (value) => {
    // Arrange
    const config = new ConfigService();
    process.env.DB_POOL_MAX = value;

    // Act / Assert
    expect(() => config.dbPoolMax).toThrow("DB_POOL_MAX deve ser um inteiro positivo");
  });
});

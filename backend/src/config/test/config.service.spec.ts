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
});

import { describe, expect, it } from "vitest";
import { generate } from "otplib";
import { generateTotpSecret, verifyTotpCode, verifyTotpCodeTimeStep } from "../totp.js";

describe("verifyTotpCodeTimeStep", () => {
  it("should return the time step of a valid code and refuse it after that step (S-4)", async () => {
    // Arrange
    const secret = generateTotpSecret();
    const code = await generate({ secret });

    // Act
    const timeStep = await verifyTotpCodeTimeStep(secret, code);
    const replay = await verifyTotpCodeTimeStep(secret, code, timeStep);

    // Assert
    expect(timeStep).toEqual(expect.any(Number));
    expect(replay).toBeNull();
    expect(await verifyTotpCode(secret, code)).toBe(true);
  });

  it("should refuse a malformed code without calling the library", async () => {
    expect(await verifyTotpCodeTimeStep(generateTotpSecret(), "12ab56")).toBeNull();
  });
});

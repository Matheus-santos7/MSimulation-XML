import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthTokenService } from "../../auth-token.service.js";
import { AuthError } from "../../errors/auth.errors.js";
import type { LoginLockoutProvider } from "../../providers/login-lockout.provider.js";
import type { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import type { UserRepository } from "../../user/user.repository.js";
import type { FinishLoginUseCase } from "../use-cases/finish-login.usecase.js";
import { LoginUseCase } from "../use-cases/login.usecase.js";
import { userFixture } from "./fixtures.js";

const LOCKED_STATE = { failedLoginAttempts: 5, lockedUntil: new Date("2100-01-01") };

describe("LoginUseCase", () => {
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let hasher: Record<string, unknown>;
  let lockout: Record<string, ReturnType<typeof vi.fn>>;
  let tokens: { buildTwoFactorChallenge: ReturnType<typeof vi.fn> };
  let finishLogin: { execute: ReturnType<typeof vi.fn> };
  let useCase: LoginUseCase;

  beforeEach(() => {
    users = {
      findByEmail: vi.fn().mockResolvedValue(userFixture()),
      updateLoginLockout: vi.fn(),
      clearLoginLockout: vi.fn(),
    };
    hasher = {
      verify: vi.fn().mockResolvedValue(true),
      authFailureDelay: vi.fn(),
      dummyPasswordHash: "scrypt$dummy",
    };
    lockout = {
      isLoginLocked: vi.fn((lockedUntil: Date | null) => lockedUntil != null),
      lockoutMessage: vi.fn().mockReturnValue("Muitas tentativas"),
      nextFailedLoginState: vi.fn().mockReturnValue(LOCKED_STATE),
    };
    tokens = { buildTwoFactorChallenge: vi.fn().mockReturnValue({ requiresTwoFactor: true }) };
    finishLogin = { execute: vi.fn().mockResolvedValue({ accessToken: "jwt" }) };
    useCase = new LoginUseCase(
      users as unknown as UserRepository,
      hasher as unknown as PasswordHasherProvider,
      lockout as unknown as LoginLockoutProvider,
      tokens as unknown as AuthTokenService,
      finishLogin as unknown as FinishLoginUseCase,
    );
  });

  it("should normalize the e-mail, clear the lockout and finish the login", async () => {
    // Act
    const result = await useCase.execute(
      { email: " Ana@Example.com ", password: "x" },
      { ipAddress: "1.1.1.1" },
    );

    // Assert
    expect(users.findByEmail).toHaveBeenCalledWith("ana@example.com");
    expect(users.clearLoginLockout).toHaveBeenCalledWith("user-1");
    expect(finishLogin.execute).toHaveBeenCalledWith("user-1", { ipAddress: "1.1.1.1" });
    expect(result).toEqual({ accessToken: "jwt" });
  });

  it("should answer the 2FA challenge instead of a session when TOTP is enabled", async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(userFixture({ totpEnabledAt: new Date() }));

    // Act
    const result = await useCase.execute({ email: "ana@example.com", password: "x" });

    // Assert
    expect(result).toEqual({ requiresTwoFactor: true });
    expect(finishLogin.execute).not.toHaveBeenCalled();
  });

  it("should count the failed attempt and answer the generic message on a wrong password", async () => {
    // Arrange
    (hasher.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    // Act
    const result = useCase.execute({ email: "ana@example.com", password: "errada" });

    // Assert
    await expect(result).rejects.toThrow(new AuthError.Unauthorized());
    expect(users.updateLoginLockout).toHaveBeenCalledWith("user-1", LOCKED_STATE);
    expect(hasher.authFailureDelay).toHaveBeenCalledOnce();
  });

  it("should verify against the dummy hash when the e-mail does not exist", async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(null);
    (hasher.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    // Act
    const result = useCase.execute({ email: "ninguem@example.com", password: "x" });

    // Assert
    await expect(result).rejects.toBeInstanceOf(AuthError.Unauthorized);
    expect(hasher.verify).toHaveBeenCalledWith("x", "scrypt$dummy");
    expect(users.updateLoginLockout).not.toHaveBeenCalled();
  });

  it("should refuse a locked account before checking the password", async () => {
    // Arrange
    users.findByEmail.mockResolvedValue(userFixture({ lockedUntil: LOCKED_STATE.lockedUntil }));

    // Act
    const result = useCase.execute({ email: "ana@example.com", password: "x" });

    // Assert
    await expect(result).rejects.toMatchObject({ message: "Muitas tentativas", status: 429 });
    expect(hasher.verify).not.toHaveBeenCalled();
  });
});

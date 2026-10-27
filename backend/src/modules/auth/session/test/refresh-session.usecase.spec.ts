import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../errors/auth.errors.js";
import type { OpaqueTokenProvider } from "../../providers/opaque-token.provider.js";
import type { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import type { FinishLoginUseCase } from "../use-cases/finish-login.usecase.js";
import { RefreshSessionUseCase } from "../use-cases/refresh-session.usecase.js";
import type { UserSessionRepository } from "../user-session.repository.js";

describe("RefreshSessionUseCase", () => {
  let sessions: Record<string, ReturnType<typeof vi.fn>>;
  let hasher: { authFailureDelay: ReturnType<typeof vi.fn> };
  let finishLogin: { execute: ReturnType<typeof vi.fn> };
  let useCase: RefreshSessionUseCase;

  beforeEach(() => {
    sessions = {
      findActiveByRefreshTokenHash: vi
        .fn()
        .mockResolvedValue({ id: "session-1", userId: "user-1" }),
      revokeById: vi.fn(),
    };
    hasher = { authFailureDelay: vi.fn() };
    finishLogin = { execute: vi.fn().mockResolvedValue({ accessToken: "novo" }) };
    useCase = new RefreshSessionUseCase(
      sessions as unknown as UserSessionRepository,
      { hashRefreshToken: (token: string) => `hash:${token}` } as unknown as OpaqueTokenProvider,
      hasher as unknown as PasswordHasherProvider,
      finishLogin as unknown as FinishLoginUseCase,
    );
  });

  it("should rotate: revoke the current session and open a new one", async () => {
    // Act
    const result = await useCase.execute("refresh-token");

    // Assert
    expect(sessions.findActiveByRefreshTokenHash).toHaveBeenCalledWith("hash:refresh-token");
    expect(sessions.revokeById).toHaveBeenCalledWith("session-1");
    expect(finishLogin.execute).toHaveBeenCalledWith("user-1", {});
    expect(result).toEqual({ accessToken: "novo" });
  });

  it("should answer 401 with a delay when the refresh token is unknown, revoked or expired", async () => {
    // Arrange
    sessions.findActiveByRefreshTokenHash.mockResolvedValue(null);

    // Act
    const result = useCase.execute("refresh-token");

    // Assert
    await expect(result).rejects.toThrow(
      new AuthError.Unauthorized("Sessão expirada. Entre novamente."),
    );
    expect(hasher.authFailureDelay).toHaveBeenCalledOnce();
    expect(sessions.revokeById).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthTokenService } from "../../auth-token.service.js";
import { AuthError } from "../../errors/auth.errors.js";
import type { LoginLockoutProvider } from "../../providers/login-lockout.provider.js";
import type { TotpProvider } from "../../providers/totp.provider.js";
import { userFixture } from "../../session/test/fixtures.js";
import type { FinishLoginUseCase } from "../../session/use-cases/finish-login.usecase.js";
import type { UserRepository } from "../../user/user.repository.js";
import { VerifyTwoFactorLoginUseCase } from "../use-cases/verify-two-factor-login.usecase.js";

const EXPIRED = "Sessão de verificação expirada. Entre novamente.";
const PENDING = { userId: "user-1", tokenVersion: 3, typ: "2fa_pending" as const };

describe("VerifyTwoFactorLoginUseCase", () => {
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let totp: Record<string, ReturnType<typeof vi.fn>>;
  let tokens: { verifyTwoFactorPending: ReturnType<typeof vi.fn> };
  let finishLogin: { execute: ReturnType<typeof vi.fn> };
  let useCase: VerifyTwoFactorLoginUseCase;

  beforeEach(() => {
    users = {
      findAuthUserById: vi
        .fn()
        .mockResolvedValue(userFixture({ totpEnabledAt: new Date(), totpSecretEnc: "enc" })),
      updateLoginLockout: vi.fn(),
      clearLoginLockout: vi.fn(),
    };
    totp = {
      decryptSecret: vi.fn().mockReturnValue("secret"),
      verifyCode: vi.fn().mockResolvedValue(true),
    };
    tokens = { verifyTwoFactorPending: vi.fn().mockReturnValue(PENDING) };
    finishLogin = { execute: vi.fn().mockResolvedValue({ accessToken: "jwt" }) };
    useCase = new VerifyTwoFactorLoginUseCase(
      users as unknown as UserRepository,
      {
        isLoginLocked: (lockedUntil: Date | null) => lockedUntil != null,
        lockoutMessage: () => "Muitas tentativas",
        nextFailedLoginState: () => ({ failedLoginAttempts: 1, lockedUntil: null }),
      } as unknown as LoginLockoutProvider,
      totp as unknown as TotpProvider,
      tokens as unknown as AuthTokenService,
      finishLogin as unknown as FinishLoginUseCase,
    );
  });

  it("should finish the login with a valid challenge and code", async () => {
    // Act
    const result = await useCase.execute({ twoFactorToken: "jwt-2fa", code: "123456" }, {});

    // Assert
    expect(totp.verifyCode).toHaveBeenCalledWith("secret", "123456");
    expect(users.clearLoginLockout).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ accessToken: "jwt" });
  });

  it("should treat an invalid or expired challenge token as expired", async () => {
    // Arrange
    tokens.verifyTwoFactorPending.mockImplementation(() => {
      throw new Error("jwt expired");
    });

    // Act / Assert
    await expect(useCase.execute({ twoFactorToken: "x", code: "123456" }, {})).rejects.toThrow(
      new AuthError.TwoFactorRequired(EXPIRED),
    );
  });

  it("should refuse an access token used as challenge", async () => {
    // Arrange
    tokens.verifyTwoFactorPending.mockReturnValue({ ...PENDING, typ: "access" });

    // Act / Assert
    await expect(useCase.execute({ twoFactorToken: "x", code: "123456" }, {})).rejects.toThrow(
      new AuthError.TwoFactorRequired(),
    );
  });

  it("should expire the challenge after a global logout (tokenVersion changed)", async () => {
    // Arrange
    tokens.verifyTwoFactorPending.mockReturnValue({ ...PENDING, tokenVersion: 2 });

    // Act / Assert
    await expect(useCase.execute({ twoFactorToken: "x", code: "123456" }, {})).rejects.toThrow(
      new AuthError.TwoFactorRequired(EXPIRED),
    );
    expect(finishLogin.execute).not.toHaveBeenCalled();
  });

  it("should count the failed attempt on a wrong code", async () => {
    // Arrange
    totp.verifyCode.mockResolvedValue(false);

    // Act
    const result = useCase.execute({ twoFactorToken: "x", code: "000000" }, {});

    // Assert
    await expect(result).rejects.toBeInstanceOf(AuthError.TwoFactorRequired);
    expect(users.updateLoginLockout).toHaveBeenCalledWith("user-1", {
      failedLoginAttempts: 1,
      lockedUntil: null,
    });
  });
});

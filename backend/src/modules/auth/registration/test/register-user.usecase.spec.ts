import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGISTER_GENERIC_FAILURE_MESSAGE } from "../../../../lib/auth/config.js";
import type { AuthSettings } from "../../auth.settings.js";
import type { SendVerificationEmailUseCase } from "../../email-verification/use-cases/send-verification-email.usecase.js";
import { AuthError } from "../../errors/auth.errors.js";
import type { EmailSenderProvider } from "../../providers/email-sender.provider.js";
import type { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import type { FinishLoginUseCase } from "../../session/use-cases/finish-login.usecase.js";
import type { UserRepository } from "../../user/user.repository.js";
import type { AuthUserWithTenant } from "../../user/user.types.js";
import { RegisterUserUseCase } from "../use-cases/register-user.usecase.js";

const existingUser: AuthUserWithTenant = {
  id: "user-1",
  email: "existente@example.com",
  name: "Usuário",
  password: "scrypt$hash",
  tenantId: null,
  role: "MEMBER",
  emailVerifiedAt: new Date(),
  totpSecretEnc: null,
  totpEnabledAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  tokenVersion: 0,
  tenant: null,
};

const newUser = { ...existingUser, id: "user-new", email: "novo@example.com", name: null };

describe("RegisterUserUseCase", () => {
  let userRepository: {
    findByEmail: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
  };
  let finishLogin: { execute: ReturnType<typeof vi.fn> };
  let sendVerificationEmail: { execute: ReturnType<typeof vi.fn> };
  let passwordHasher: {
    hash: ReturnType<typeof vi.fn>;
    authFailureDelay: ReturnType<typeof vi.fn>;
  };
  let emailSender: { sendRegistrationAttemptAlert: ReturnType<typeof vi.fn> };
  let settings: {
    requireEmailVerification: boolean;
    appPublicUrl: string;
    registerGenericFailureMessage: string;
  };
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    userRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue(newUser),
    };
    finishLogin = {
      execute: vi.fn().mockResolvedValue({ accessToken: "token", refreshToken: "refresh" }),
    };
    sendVerificationEmail = { execute: vi.fn().mockResolvedValue(undefined) };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue("scrypt$newhash"),
      authFailureDelay: vi.fn(),
    };
    emailSender = { sendRegistrationAttemptAlert: vi.fn().mockResolvedValue(undefined) };
    settings = {
      requireEmailVerification: false,
      appPublicUrl: "https://app.example.com",
      registerGenericFailureMessage: REGISTER_GENERIC_FAILURE_MESSAGE,
    };
    useCase = new RegisterUserUseCase(
      userRepository as unknown as UserRepository,
      finishLogin as unknown as FinishLoginUseCase,
      sendVerificationEmail as unknown as SendVerificationEmailUseCase,
      passwordHasher as unknown as PasswordHasherProvider,
      emailSender as unknown as EmailSenderProvider,
      settings as unknown as AuthSettings,
    );
  });

  it("should create the user and start the session", async () => {
    // Act
    const session = await useCase.execute(
      { email: "novo@example.com", password: "SenhaForte1" },
      { ipAddress: "1.1.1.1" },
    );

    // Assert
    expect(session).toEqual({ accessToken: "token", refreshToken: "refresh" });
    expect(userRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "novo@example.com", passwordHash: "scrypt$newhash" }),
    );
    expect(finishLogin.execute).toHaveBeenCalledWith("user-new", { ipAddress: "1.1.1.1" });
    expect(sendVerificationEmail.execute).not.toHaveBeenCalled();
  });

  it("should send the confirmation e-mail and ignore its failure when verification is required", async () => {
    // Arrange
    settings.requireEmailVerification = true;
    sendVerificationEmail.execute.mockRejectedValue(new AuthError.EmailDelivery("Brevo fora"));

    // Act
    const session = await useCase.execute({ email: "novo@example.com", password: "SenhaForte1" });

    // Assert
    expect(session).toEqual({ accessToken: "token", refreshToken: "refresh" });
    expect(userRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerifiedAt: null }),
    );
  });

  it("should reject an existing e-mail with the generic message, same timing and an alert", async () => {
    // Arrange
    userRepository.findByEmail.mockResolvedValue(existingUser);

    // Act
    const result = useCase.execute({ email: existingUser.email, password: "SenhaForte1" });

    // Assert
    await expect(result).rejects.toThrow(new AuthError.State(REGISTER_GENERIC_FAILURE_MESSAGE));
    expect(emailSender.sendRegistrationAttemptAlert).toHaveBeenCalledOnce();
    expect(passwordHasher.hash).toHaveBeenCalledOnce();
    expect(passwordHasher.authFailureDelay).toHaveBeenCalledOnce();
    expect(userRepository.createUser).not.toHaveBeenCalled();
  });

  it("should reject a unique-constraint race with the same generic message", async () => {
    // Arrange
    userRepository.createUser.mockRejectedValue({ code: "P2002" });

    // Act
    const result = useCase.execute({ email: "novo@example.com", password: "SenhaForte1" });

    // Assert
    await expect(result).rejects.toBeInstanceOf(AuthError.State);
    expect(emailSender.sendRegistrationAttemptAlert).toHaveBeenCalledOnce();
  });
});

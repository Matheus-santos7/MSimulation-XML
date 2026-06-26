import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { REGISTER_GENERIC_FAILURE_MESSAGE } from "../../../../lib/auth/config.js";
import { AuthStateError } from "../../domain/errors/auth-state.error.js";
import type { AuthUserWithTenant } from "../../domain/entities/user.entity.js";
import { RegisterUserUseCase } from "./register-user.use-case.js";

const existingUser: AuthUserWithTenant = {
  id: "user-1",
  email: "existente@example.com",
  name: "Usuário",
  password: "scrypt$hash",
  tenantId: null,
  role: "MEMBER",
  emailVerifiedAt: new Date(),
  totpEnabledAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  tokenVersion: 0,
  tenant: null,
};

function createUseCase(overrides?: {
  existingUser?: AuthUserWithTenant | null;
  createThrowsUnique?: boolean;
}) {
  const emailSender = {
    sendPasswordReset: mock.fn(async () => {}),
    sendEmailVerification: mock.fn(async () => {}),
    sendRegistrationAttemptAlert: mock.fn(async () => {}),
  };

  const passwordHasher = {
    hash: mock.fn(async () => "scrypt$newhash"),
    verify: mock.fn(async () => false),
    authFailureDelay: mock.fn(async () => {}),
    dummyPasswordHash: "scrypt$dummy",
  };

  const useCase = new RegisterUserUseCase(
    {
      findByEmail: mock.fn(async () => overrides?.existingUser ?? null),
      existsByEmail: mock.fn(async () => overrides?.existingUser != null),
      createUser: mock.fn(async () => {
        if (overrides?.createThrowsUnique) {
          throw { code: "P2002" };
        }
        return {
          id: "user-new",
          email: "novo@example.com",
          name: null,
          password: "scrypt$newhash",
          tenantId: null,
          role: "MEMBER",
          emailVerifiedAt: new Date(),
          totpEnabledAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          tokenVersion: 0,
        };
      }),
    } as never,
    {
      execute: mock.fn(async () => ({ accessToken: "token", refreshToken: "refresh" })),
    } as never,
    {
      execute: mock.fn(async () => {}),
    } as never,
    passwordHasher as never,
    emailSender as never,
    {
      requireEmailVerification: false,
      genericFailureMessage: REGISTER_GENERIC_FAILURE_MESSAGE,
      appPublicUrl: "https://app.example.com",
    },
  );

  return { useCase, emailSender, passwordHasher };
}

describe("RegisterUserUseCase", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("rejeita e-mail existente com mensagem genérica", async () => {
    const { useCase, emailSender, passwordHasher } = createUseCase({ existingUser });

    await assert.rejects(
      () =>
        useCase.execute(
          { email: existingUser.email, password: "SenhaForte1" },
          () => "jwt",
        ),
      (error: unknown) => {
        assert.ok(error instanceof AuthStateError);
        assert.equal(error.message, REGISTER_GENERIC_FAILURE_MESSAGE);
        return true;
      },
    );

    assert.equal(emailSender.sendRegistrationAttemptAlert.mock.callCount(), 1);
    assert.equal(passwordHasher.hash.mock.callCount(), 1);
    assert.equal(passwordHasher.authFailureDelay.mock.callCount(), 1);
  });

  it("rejeita corrida de unique constraint com a mesma mensagem genérica", async () => {
    const { useCase, emailSender } = createUseCase({ createThrowsUnique: true });

    await assert.rejects(
      () =>
        useCase.execute(
          { email: "novo@example.com", password: "SenhaForte1" },
          () => "jwt",
        ),
      AuthStateError,
    );

    assert.equal(emailSender.sendRegistrationAttemptAlert.mock.callCount(), 1);
  });
});

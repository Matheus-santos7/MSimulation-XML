import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { ZodError, type ZodTypeAny } from "zod";
import { zodValidationErrorResponse } from "../../../lib/http/domain-errors.js";
import { HttpError } from "../../../lib/http/http-error.js";
import { ClassValidatorPipe } from "../../../nest/http/class-validator.pipe.js";
import { DisableTwoFactorRequestDTO } from "../two-factor/dtos/disable-two-factor.request.dto.js";
import { EnableTwoFactorRequestDTO } from "../two-factor/dtos/enable-two-factor.request.dto.js";
import { VerifyTwoFactorRequestDTO } from "../two-factor/dtos/verify-two-factor.request.dto.js";
import { VerifyEmailRequestDTO } from "../email-verification/dtos/verify-email.request.dto.js";
import { ForgotPasswordRequestDTO } from "../password-reset/dtos/forgot-password.request.dto.js";
import { ResetPasswordRequestDTO } from "../password-reset/dtos/reset-password.request.dto.js";
import { RegisterRequestDTO } from "../registration/dtos/register.request.dto.js";
import { LoginRequestDTO } from "../session/dtos/login.request.dto.js";
import { LogoutRequestDTO } from "../session/dtos/logout.request.dto.js";
import { RefreshRequestDTO } from "../session/dtos/refresh.request.dto.js";
import * as legacy from "./legacy-auth.schemas.js";

type Outcome = { ok: true; data: unknown } | { ok: false; status: number; body: unknown };

function viaZod(schema: ZodTypeAny, input: unknown): Outcome {
  try {
    return { ok: true, data: schema.parse(input) };
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    const { status, body } = zodValidationErrorResponse(error);

    return { ok: false, status, body };
  }
}

function viaDto(dto: new () => object, input: unknown): Outcome {
  try {
    return { ok: true, data: { ...new ClassValidatorPipe(dto).transform(input) } };
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;

    return { ok: false, status: error.status, body: error.body };
  }
}

const STRONG = "Senha1234";
const LINK_TOKEN = "t".repeat(32);
const REFRESH = "r".repeat(20);

/** Entradas comuns a todo corpo: ausente, vazio, tipos errados na raiz. */
const ROOT_INPUTS: unknown[] = [undefined, null, {}, [], "texto", 42];

const CASES: ReadonlyArray<{
  name: string;
  schema: ZodTypeAny;
  dto: new () => object;
  inputs: unknown[];
}> = [
  {
    name: "login",
    schema: legacy.loginBodySchema,
    dto: LoginRequestDTO,
    inputs: [
      { email: " Usuario@Empresa.COM ", password: "x", captchaToken: " tok " },
      { email: "", password: "" },
      { email: "invalido", password: "x" },
      { email: 10, password: 10 },
      { email: null, password: null },
      { email: `${"a".repeat(250)}@b.com`, password: "x".repeat(129) },
      { email: "a@b.com", password: "x", extra: true },
      { password: "x" },
    ],
  },
  {
    name: "register",
    schema: legacy.registerBodySchema,
    dto: RegisterRequestDTO,
    inputs: [
      { email: "novo@empresa.com", password: STRONG, name: "  Ana  " },
      { email: "novo@empresa.com", password: STRONG, name: "   " },
      { email: "novo@MAILINATOR.com", password: STRONG },
      { email: "invalido", password: "abc" },
      { email: "a@b.com", password: "password" },
      { email: "a@b.com", password: "SENHA1234" },
      { email: "a@b.com", password: "senhaforte" },
      { email: "a@b.com", password: "x".repeat(200) },
      { email: "a@b.com", password: STRONG, name: "x".repeat(121) },
      { email: "a@b.com", password: STRONG, name: 5 },
      { email: "x@mailinator.com", password: "abc" },
      { email: "", password: "" },
    ],
  },
  {
    name: "forgot-password",
    schema: legacy.forgotPasswordBodySchema,
    dto: ForgotPasswordRequestDTO,
    inputs: [{ email: "a@b.com" }, { email: "x" }, { email: "a@b.com", captchaToken: 1 }],
  },
  {
    name: "reset-password",
    schema: legacy.resetPasswordBodySchema,
    dto: ResetPasswordRequestDTO,
    inputs: [
      { token: LINK_TOKEN, password: STRONG },
      { token: LINK_TOKEN, password: STRONG, code: " 123456 " },
      { token: LINK_TOKEN, password: STRONG, code: "12a456" },
      { token: "curto", password: "abc", code: "1" },
    ],
  },
  {
    name: "verify-email",
    schema: legacy.verifyEmailBodySchema,
    dto: VerifyEmailRequestDTO,
    inputs: [{ token: LINK_TOKEN }, { token: "curto" }, { token: 1 }],
  },
  {
    name: "refresh",
    schema: legacy.refreshBodySchema,
    dto: RefreshRequestDTO,
    inputs: [{ refreshToken: REFRESH }, { refreshToken: "curto" }, { refreshToken: true }],
  },
  {
    name: "logout",
    schema: legacy.logoutBodySchema,
    dto: LogoutRequestDTO,
    inputs: [{ refreshToken: REFRESH }, { refreshToken: "curto" }],
  },
  {
    name: "verify-2fa",
    schema: legacy.verify2faBodySchema,
    dto: VerifyTwoFactorRequestDTO,
    inputs: [
      { twoFactorToken: REFRESH, code: "123456" },
      { twoFactorToken: "x", code: "12" },
      { twoFactorToken: REFRESH, code: 123456 },
    ],
  },
  {
    name: "2fa/enable",
    schema: legacy.enable2faBodySchema,
    dto: EnableTwoFactorRequestDTO,
    inputs: [{ code: "123456" }, { code: "abcdef" }],
  },
  {
    name: "2fa/disable",
    schema: legacy.disable2faBodySchema,
    dto: DisableTwoFactorRequestDTO,
    inputs: [
      { password: "x", code: "123456" },
      { password: "", code: "1" },
    ],
  },
];

describe("DTOs de auth × schemas Zod anteriores", () => {
  for (const { name, schema, dto, inputs } of CASES) {
    describe(name, () => {
      it.each(
        [...ROOT_INPUTS, ...inputs].map((input) => [JSON.stringify(input) ?? "undefined", input]),
      )("should answer like the Zod schema for %s", (_label, input) => {
        expect(viaDto(dto, input)).toEqual(viaZod(schema, input));
      });
    });
  }
});

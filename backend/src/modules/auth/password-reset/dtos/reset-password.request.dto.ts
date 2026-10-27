import { z } from "zod";
import { linkTokenField, passwordField, totpCodeField } from "../../rules/credential.schemas.js";

export const resetPasswordRequestSchema = z.object({
  token: linkTokenField,
  password: passwordField,
  /** Exigido com 2FA ativo. */
  code: totpCodeField.optional(),
});

export type ResetPasswordRequestDTO = z.infer<typeof resetPasswordRequestSchema>;

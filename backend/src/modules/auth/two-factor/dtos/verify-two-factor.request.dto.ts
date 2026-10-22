import { z } from "zod";
import { captchaTokenField, totpCodeField } from "../../rules/credential.schemas.js";

export const verifyTwoFactorRequestSchema = z.object({
  /** Token `2fa_pending` devolvido pelo login. */
  twoFactorToken: z.string().min(20, "Sessão de verificação inválida"),
  code: totpCodeField,
  captchaToken: captchaTokenField,
});

export type VerifyTwoFactorRequestDTO = z.infer<typeof verifyTwoFactorRequestSchema>;

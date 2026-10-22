import { z } from "zod";
import { currentPasswordField, totpCodeField } from "../../rules/credential.schemas.js";

export const disableTwoFactorRequestSchema = z.object({
  password: currentPasswordField,
  code: totpCodeField,
});

export type DisableTwoFactorRequestDTO = z.infer<typeof disableTwoFactorRequestSchema>;

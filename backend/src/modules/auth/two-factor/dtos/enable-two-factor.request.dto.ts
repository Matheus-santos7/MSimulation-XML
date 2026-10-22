import { z } from "zod";
import { totpCodeField } from "../../rules/credential.schemas.js";

export const enableTwoFactorRequestSchema = z.object({
  code: totpCodeField,
});

export type EnableTwoFactorRequestDTO = z.infer<typeof enableTwoFactorRequestSchema>;

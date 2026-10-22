import { z } from "zod";
import { passwordField } from "../../../auth/rules/credential.schemas.js";

export const memberEmailField = z
  .string()
  .trim()
  .min(1, "E-mail obrigatório")
  .email("E-mail inválido")
  .transform((v) => v.toLowerCase());

export const memberNameField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const createMemberRequestSchema = z.object({
  email: memberEmailField,
  name: memberNameField,
  password: passwordField,
});

export type CreateMemberRequestDTO = z.infer<typeof createMemberRequestSchema>;

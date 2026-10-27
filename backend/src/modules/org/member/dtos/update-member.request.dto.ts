import { z } from "zod";
import { passwordField } from "../../../auth/rules/credential.schemas.js";
import { memberEmailField, memberNameField } from "./create-member.request.dto.js";

/** Ao menos um campo; senha vazia é ignorada e, quando enviada, segue a regra de senha forte. */
export const updateMemberRequestSchema = z
  .object({
    email: memberEmailField.optional(),
    name: memberNameField,
    password: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v : undefined)),
  })
  .refine(
    (data) => data.email !== undefined || data.name !== undefined || data.password !== undefined,
    {
      message: "Informe ao menos um campo para atualizar",
    },
  )
  .superRefine((data, ctx) => {
    if (data.password === undefined) return;
    const result = passwordField.safeParse(data.password);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ["password"] });
      }
    }
  });

export type UpdateMemberRequestDTO = z.infer<typeof updateMemberRequestSchema>;

import { z } from "zod";
import { passwordField } from "./auth/schemas.js";

const emailField = z
  .string()
  .trim()
  .min(1, "E-mail obrigatório")
  .email("E-mail inválido")
  .transform((v) => v.toLowerCase());

const nameField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const userIdParam = z.object({
  id: z.string().uuid("ID inválido"),
});

export const userCreateBody = z.object({
  email: emailField,
  name: nameField,
  password: passwordField,
});

export const userUpdateBody = z
  .object({
    email: emailField.optional(),
    name: nameField,
    password: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v : undefined)),
  })
  .refine((data) => data.email !== undefined || data.name !== undefined || data.password !== undefined, {
    message: "Informe ao menos um campo para atualizar",
  })
  .superRefine((data, ctx) => {
    if (data.password === undefined) return;
    const r = passwordField.safeParse(data.password);
    if (!r.success) {
      for (const issue of r.error.issues) {
        ctx.addIssue({ ...issue, path: ["password"] });
      }
    }
  });

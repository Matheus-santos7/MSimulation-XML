import { z } from "zod";
import {
  captchaTokenField,
  DISPOSABLE_EMAIL_DOMAINS,
  emailField,
  passwordField,
} from "../../rules/credential.schemas.js";

export const registerRequestSchema = z.object({
  email: emailField.refine((email) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return domain ? !DISPOSABLE_EMAIL_DOMAINS.has(domain) : true;
  }, "Use um e-mail permanente — domínios descartáveis não são permitidos"),
  password: passwordField,
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  captchaToken: captchaTokenField,
});

export type RegisterRequestDTO = z.infer<typeof registerRequestSchema>;

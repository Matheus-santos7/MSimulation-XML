import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .min(1, "E-mail obrigatório")
  .email("E-mail inválido")
  .max(254)
  .transform((v) => v.toLowerCase());

export const passwordField = z
  .string()
  .min(8, "Senha deve ter ao menos 8 caracteres")
  .max(128, "Senha muito longa")
  .refine((v) => /[a-z]/.test(v), "Inclua ao menos uma letra minúscula")
  .refine((v) => /[A-Z]/.test(v), "Inclua ao menos uma letra maiúscula")
  .refine((v) => /[0-9]/.test(v), "Inclua ao menos um número")
  .refine(
    (v) => !["password", "12345678", "senha123", "demo123"].includes(v.toLowerCase()),
    "Senha muito comum — escolha outra",
  );

export const loginBodySchema = z.object({
  email: emailField,
  password: z.string().min(1, "Senha obrigatória").max(128),
});

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "10minutemail.com",
]);

export const registerBodySchema = z.object({
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
  captchaToken: z.string().trim().optional(),
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(32, "Link inválido ou expirado"),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(20, "Refresh token inválido"),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(20, "Refresh token inválido").optional(),
});

export const forgotPasswordBodySchema = z.object({
  email: emailField,
});

export const totpCodeField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Informe o código de 6 dígitos do autenticador");

export const resetPasswordBodySchema = z.object({
  token: z.string().min(32, "Link inválido ou expirado"),
  password: passwordField,
  code: totpCodeField.optional(),
});

export const verify2faBodySchema = z.object({
  twoFactorToken: z.string().min(20, "Sessão de verificação inválida"),
  code: totpCodeField,
});

export const enable2faBodySchema = z.object({
  code: totpCodeField,
});

export const disable2faBodySchema = z.object({
  password: z.string().min(1, "Senha obrigatória").max(128),
  code: totpCodeField,
});

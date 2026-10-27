import { z } from "zod";

/** Campos de credencial compartilhados pelos DTOs de auth (e pelo cadastro de usuários no org). */

export const emailField = z
  .string()
  .trim()
  .min(1, "E-mail obrigatório")
  .email("E-mail inválido")
  .max(254)
  .transform((v) => v.toLowerCase());

/** Senha nova: tamanho, letra minúscula, maiúscula, número e fora da lista de senhas comuns. */
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

/** Senha atual (login, desativar 2FA): só presença e tamanho. */
export const currentPasswordField = z.string().min(1, "Senha obrigatória").max(128);

/** Código de 6 dígitos do autenticador. */
export const totpCodeField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Informe o código de 6 dígitos do autenticador");

/** Token do Cloudflare Turnstile (validado pelo captcha no controller). */
export const captchaTokenField = z.string().trim().optional();

/** Token dos links enviados por e-mail (redefinição de senha, confirmação de e-mail). */
export const linkTokenField = z.string().min(32, "Link inválido ou expirado");

/** Domínios de e-mail descartável recusados no cadastro. */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "10minutemail.com",
]);

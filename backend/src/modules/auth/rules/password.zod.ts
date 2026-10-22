import { z } from "zod";

/**
 * @deprecated Senha forte em Zod, usada pelo schema de usuário do org até ele virar DTO
 * (`StrongPasswordField` em `credential.validators.ts` é a regra nova).
 */
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

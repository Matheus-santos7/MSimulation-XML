import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import { Required } from "../../../nest/http/class-validator.pipe.js";
import {
  IsText,
  TextEmail,
  TextMatches,
  TextMaxLength,
  TextMinLength,
  TextRefine,
  Trim,
} from "../../../nest/http/text.validators.js";

/**
 * Regras de credencial compartilhadas pelos DTOs de auth (e pelo cadastro de usuários no org).
 * Cada decorator reproduz o campo Zod que substituiu, na mesma ordem de mensagens.
 */

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const COMMON_PASSWORDS = new Set(["password", "12345678", "senha123", "demo123"]);
const TOTP_CODE = /^\d{6}$/;

/** Domínios de e-mail descartável recusados no cadastro. */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "10minutemail.com",
]);

/** `z.string().trim().min(1).email().max(254).transform(toLowerCase)` */
export function EmailField(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value)),
    Required(),
    IsText(),
    TextMinLength(1, "E-mail obrigatório"),
    TextEmail("E-mail inválido"),
    TextMaxLength(EMAIL_MAX_LENGTH),
  );
}

/** E-mail do cadastro: o mesmo campo, recusando domínios descartáveis. */
export function PermanentEmailField(): PropertyDecorator {
  return applyDecorators(
    EmailField(),
    TextRefine((email) => {
      const domain = email.split("@")[1]?.toLowerCase();
      return domain ? !DISPOSABLE_EMAIL_DOMAINS.has(domain) : true;
    }, "Use um e-mail permanente — domínios descartáveis não são permitidos"),
  );
}

/** Senha nova: tamanho, letra minúscula, maiúscula, número e fora da lista de senhas comuns. */
export function StrongPasswordRules(): PropertyDecorator {
  return applyDecorators(
    IsText(),
    TextMinLength(PASSWORD_MIN_LENGTH, "Senha deve ter ao menos 8 caracteres"),
    TextMaxLength(PASSWORD_MAX_LENGTH, "Senha muito longa"),
    TextRefine((v) => /[a-z]/.test(v), "Inclua ao menos uma letra minúscula"),
    TextRefine((v) => /[A-Z]/.test(v), "Inclua ao menos uma letra maiúscula"),
    TextRefine((v) => /[0-9]/.test(v), "Inclua ao menos um número"),
    TextRefine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "Senha muito comum — escolha outra"),
  );
}

/** Senha nova obrigatória. */
export function StrongPasswordField(): PropertyDecorator {
  return applyDecorators(Required(), StrongPasswordRules());
}

/** Senha atual (login, desativar 2FA): só presença e tamanho. */
export function CurrentPasswordField(): PropertyDecorator {
  return applyDecorators(
    Required(),
    IsText(),
    TextMinLength(1, "Senha obrigatória"),
    TextMaxLength(PASSWORD_MAX_LENGTH),
  );
}

/** Código de 6 dígitos do autenticador (sem `Required`: o DTO decide se é obrigatório). */
export function TotpCodeRules(): PropertyDecorator {
  return applyDecorators(
    Trim(),
    IsText(),
    TextMatches(TOTP_CODE, "Informe o código de 6 dígitos do autenticador"),
  );
}

/** Token do Turnstile, opcional (validado pelo captcha no controller). */
export function CaptchaTokenField(): PropertyDecorator {
  return applyDecorators(Trim(), IsText());
}

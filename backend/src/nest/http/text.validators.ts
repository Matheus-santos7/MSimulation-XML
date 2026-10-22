import { Transform } from "class-transformer";
import { ValidateBy, type ValidationOptions } from "class-validator";

/**
 * Validadores de texto com a semântica do Zod (`z.string()...`), usados nos DTOs que
 * substituíram schemas Zod sem mudar `error`/`details`:
 *
 * - valor que não é string gera só `IsText` ("Expected string, received number");
 * - as demais regras ignoram valores que não são string e rodam todas quando são;
 * - sem `message`, cada regra usa a mensagem padrão do Zod.
 *
 * Empilhe como a cadeia do Zod ao contrário: o decorator mais perto do campo roda primeiro.
 */

function zodTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isNaN(value)) return "nan";

  return typeof value;
}

function textRule(
  name: string,
  isValid: (value: string) => boolean,
  defaultMessage: string,
  message?: string,
): PropertyDecorator {
  const options: ValidationOptions = { message: message ?? defaultMessage };

  // O class-validator indexa as mensagens pelo nome: regras repetidas no campo (vários
  // `.refine`) precisam de nomes distintos.
  return ValidateBy(
    {
      name: `${name}:${options.message}`,
      validator: {
        validate: (value: unknown) => typeof value !== "string" || isValid(value),
      },
    },
    options,
  );
}

/** `z.string()`: o valor precisa ser texto. */
export function IsText(): PropertyDecorator {
  return ValidateBy({
    name: "isText",
    validator: {
      validate: (value: unknown) => typeof value === "string",
      defaultMessage: (args) => `Expected string, received ${zodTypeOf(args?.value)}`,
    },
  });
}

/** `.min(n)` */
export function TextMinLength(min: number, message?: string): PropertyDecorator {
  return textRule(
    "textMinLength",
    (value) => value.length >= min,
    `String must contain at least ${min} character(s)`,
    message,
  );
}

/** `.max(n)` */
export function TextMaxLength(max: number, message?: string): PropertyDecorator {
  return textRule(
    "textMaxLength",
    (value) => value.length <= max,
    `String must contain at most ${max} character(s)`,
    message,
  );
}

/** Mesma expressão do `z.string().email()` (Zod 3.25), sem os escapes redundantes. */
const ZOD_EMAIL_REGEX =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

/** `.email()` */
export function TextEmail(message?: string): PropertyDecorator {
  return textRule("textEmail", (value) => ZOD_EMAIL_REGEX.test(value), "Invalid email", message);
}

/** `.regex(re)` */
export function TextMatches(pattern: RegExp, message?: string): PropertyDecorator {
  return textRule("textMatches", (value) => pattern.test(value), "Invalid", message);
}

/** `.refine(fn, message)` */
export function TextRefine(
  isValid: (value: string) => boolean,
  message: string,
): PropertyDecorator {
  return textRule("textRefine", isValid, "Invalid input", message);
}

/** `.trim()` (aplicado antes das regras, como no Zod). */
export function Trim(): PropertyDecorator {
  return Transform(({ value }) => (typeof value === "string" ? value.trim() : value));
}

/** `.transform((v) => v.toLowerCase())` */
export function ToLowerCase(): PropertyDecorator {
  return Transform(({ value }) => (typeof value === "string" ? value.toLowerCase() : value));
}

/** `.transform((v) => (v ? v : undefined))`: texto vazio vira ausente. */
export function EmptyToUndefined(): PropertyDecorator {
  return Transform(({ value }) => (value === "" ? undefined : value));
}

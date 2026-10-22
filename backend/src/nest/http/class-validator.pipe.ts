import type { PipeTransform } from "@nestjs/common";
import { plainToInstance, type ClassConstructor } from "class-transformer";
import { IsDefined, validateSync, type ValidationError } from "class-validator";
import { HttpError } from "../../lib/http/http-error.js";

const HTTP_BAD_REQUEST = 400;
const DEFAULT_INVALID_MESSAGE = "Dados inválidos";

/** Mensagem do Zod para campo ausente; mantida nos DTOs que substituíram schemas Zod. */
export const ZOD_REQUIRED_MESSAGE = "Required";

/**
 * Campo obrigatório. Ausente (`undefined`), responde só esta mensagem: as demais regras do
 * campo não rodam (o pipe usa `skipUndefinedProperties`), como no Zod.
 */
export function Required(message: string = ZOD_REQUIRED_MESSAGE): PropertyDecorator {
  return IsDefined({ message });
}

export type ClassValidatorPipeOptions = {
  /**
   * Mensagem fixa no lugar da primeira mensagem de validação. A resposta passa a ser
   * `{ error: invalidMessage, details: { formErrors, fieldErrors } }`, como o `ZodValidationPipe`.
   */
  invalidMessage?: string;
};

type FieldErrors = Record<string, string[]>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Nome da regra do `@Required()` (é um `@IsDefined`). */
const REQUIRED_CONSTRAINT = "isDefined";

/**
 * Mensagens de um campo e dos campos aninhados dele (`flatten()` do Zod agrupa no campo raiz).
 * `@IsDefined` também recusa `null`; como no Zod, `null` só gera o erro de tipo do campo.
 */
function collectMessages(error: ValidationError): string[] {
  const own = Object.entries(error.constraints ?? {})
    .filter(([name]) => name !== REQUIRED_CONSTRAINT || error.value === undefined)
    .map(([, message]) => message);
  const nested = (error.children ?? []).flatMap(collectMessages);

  return [...own, ...nested];
}

function toFieldErrors(errors: readonly ValidationError[]): FieldErrors {
  return Object.fromEntries(
    errors.map((error) => [error.property, collectMessages(error)] as const),
  );
}

/**
 * Valida `@Body`, `@Param` ou `@Query` com um DTO `class-validator`.
 *
 * O DTO é passado no construtor (`new ClassValidatorPipe(CreateBrandDTO)`): o projeto não
 * depende de `emitDecoratorMetadata`. Conversão de tipo é explícita no DTO (`@Type(() => Number)`).
 * Campos fora do DTO são descartados, como no `z.object()`. Campo ausente só é erro quando
 * declara `@Required()`; as outras regras rodam apenas para valores presentes.
 *
 * Falha: 400 `{ error: <primeira mensagem>, details: { campo: [mensagens] } }`, o mesmo formato
 * que o frontend já lê dos schemas Zod.
 */
export class ClassValidatorPipe<TDto extends object> implements PipeTransform<unknown, TDto> {
  constructor(
    private readonly dto: ClassConstructor<TDto>,
    private readonly options: ClassValidatorPipeOptions = {},
  ) {}

  transform(value: unknown): TDto {
    // `z.object()` com corpo ausente ou que não é objeto: erro na raiz, sem campos.
    if (!isPlainObject(value)) {
      throw new HttpError(HTTP_BAD_REQUEST, DEFAULT_INVALID_MESSAGE, {
        error: DEFAULT_INVALID_MESSAGE,
        details: {},
      });
    }

    const instance = plainToInstance(this.dto, value);
    const errors = validateSync(instance, { whitelist: true, skipUndefinedProperties: true });
    if (errors.length === 0) return instance;

    const fieldErrors = toFieldErrors(errors);
    const { invalidMessage } = this.options;
    if (invalidMessage) {
      throw new HttpError(HTTP_BAD_REQUEST, invalidMessage, {
        error: invalidMessage,
        details: { formErrors: [], fieldErrors },
      });
    }

    const message = Object.values(fieldErrors).flat()[0] ?? DEFAULT_INVALID_MESSAGE;

    throw new HttpError(HTTP_BAD_REQUEST, message, { error: message, details: fieldErrors });
  }
}

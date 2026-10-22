import type { PipeTransform } from "@nestjs/common";
import { plainToInstance, type ClassConstructor } from "class-transformer";
import { validateSync, type ValidationError } from "class-validator";
import { HttpError } from "../../lib/http/http-error.js";

const HTTP_BAD_REQUEST = 400;
const DEFAULT_INVALID_MESSAGE = "Dados inválidos";

export type ClassValidatorPipeOptions = {
  /**
   * Mensagem fixa no lugar da primeira mensagem de validação. A resposta passa a ser
   * `{ error: invalidMessage, details: { formErrors, fieldErrors } }`, como o `ZodValidationPipe`.
   */
  invalidMessage?: string;
};

type FieldErrors = Record<string, string[]>;

/** Mensagens de um campo e dos campos aninhados dele (`flatten()` do Zod agrupa no campo raiz). */
function collectMessages(error: ValidationError): string[] {
  const own = Object.values(error.constraints ?? {});
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
 * Campos fora do DTO são descartados, como no `z.object()`.
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
    const instance = plainToInstance(this.dto, value ?? {});
    const errors = validateSync(instance, { whitelist: true });
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

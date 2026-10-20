import type { PipeTransform } from "@nestjs/common";
import type { z, ZodTypeAny } from "zod";
import { HttpError } from "../../lib/http/http-error.js";

const HTTP_BAD_REQUEST = 400;

export type ZodValidationPipeOptions = {
  /**
   * Mensagem fixa no lugar da primeira mensagem do Zod. A resposta passa a ser
   * `{ error: invalidMessage, details: error.flatten() }` (formato das rotas de movimentação).
   */
  invalidMessage?: string;
};

/**
 * Valida `@Body`, `@Param` ou `@Query` com o schema Zod da rota.
 * Sem opções, o `ZodError` segue para o filtro, que responde 400 `{ error, details }`.
 */
export class ZodValidationPipe<TSchema extends ZodTypeAny> implements PipeTransform<unknown, z.infer<TSchema>> {
  constructor(
    private readonly schema: TSchema,
    private readonly options: ZodValidationPipeOptions = {},
  ) {}

  transform(value: unknown): z.infer<TSchema> {
    const { invalidMessage } = this.options;
    if (!invalidMessage) return this.schema.parse(value);

    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new HttpError(HTTP_BAD_REQUEST, invalidMessage, {
        error: invalidMessage,
        details: parsed.error.flatten(),
      });
    }

    return parsed.data;
  }
}

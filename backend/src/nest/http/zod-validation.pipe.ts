import type { PipeTransform } from "@nestjs/common";
import type { z, ZodTypeAny } from "zod";

/**
 * Valida `@Body`, `@Param` ou `@Query` com o schema Zod da rota.
 * O `ZodError` segue para o filtro, que responde 400 `{ error, details }`.
 */
export class ZodValidationPipe<TSchema extends ZodTypeAny> implements PipeTransform<unknown, z.infer<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.infer<TSchema> {
    return this.schema.parse(value);
  }
}

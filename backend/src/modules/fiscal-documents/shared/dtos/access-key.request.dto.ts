import { z, type ZodTypeAny } from "zod";

const ACCESS_KEY_LENGTH = 44;

/** `:chave` das rotas de NF-e e CT-e (chave de acesso de 44 dígitos). */
export const accessKeyParam = z.object({
  chave: z.string().length(ACCESS_KEY_LENGTH),
});

export type AccessKeyParam = z.infer<typeof accessKeyParam>;

/** Corpo ausente vira `{}` antes da validação (as rotas de ciclo de vida aceitam POST sem corpo). */
export function optionalBody<TSchema extends ZodTypeAny>(schema: TSchema) {
  return z.preprocess((body) => body ?? {}, schema);
}

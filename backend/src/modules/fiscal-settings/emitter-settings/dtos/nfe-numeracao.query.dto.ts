import { z } from "zod";

/** Prévia de numeração de uma série NF-e (`GET /fiscal-settings/nfe-numeracao`). */
export const nfeNumeracaoQuerySchema = z.object({
  serie: z.coerce.number().int().min(1).max(999),
  numeroInicial: z.coerce.number().int().min(1).max(999_999_999).optional().default(1),
});

export type NfeNumeracaoQueryDTO = z.infer<typeof nfeNumeracaoQuerySchema>;

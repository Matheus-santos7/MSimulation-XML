import { z } from "zod";

const MAX_BACKFILL_LIMIT = 200;

/** Body opcional de POST /fiscal-validation/backfill: sem corpo, vale o limite padrão. */
export const nfeValidationBackfillBody = z
  .object({ limit: z.number().int().min(1).max(MAX_BACKFILL_LIMIT).optional() })
  .nullish()
  .transform((body) => body ?? {});

export type NfeValidationBackfillBody = z.infer<typeof nfeValidationBackfillBody>;

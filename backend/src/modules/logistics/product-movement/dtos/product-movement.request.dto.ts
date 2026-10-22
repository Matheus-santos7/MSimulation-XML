import { z } from "zod";

const MAX_MOVEMENTS_LIMIT = 200;

/** Query de GET /movimentacoes-produto. */
export const productMovementsQuery = z.object({
  productId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(MAX_MOVEMENTS_LIMIT).optional(),
});

export type ProductMovementsQuery = z.infer<typeof productMovementsQuery>;

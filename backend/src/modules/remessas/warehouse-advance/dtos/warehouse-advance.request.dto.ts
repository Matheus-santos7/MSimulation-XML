import { z } from "zod";

/** Body de POST /movimentacoes/avanco-cd. Origem e destino precisam ser do mesmo marketplace. */
export const warehouseAdvanceBody = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
  quantidade: z.number().int().min(1),
  unidadeOrigemId: z.string().uuid(),
  unidadeDestinoId: z.string().uuid(),
});

export type WarehouseAdvanceBody = z.infer<typeof warehouseAdvanceBody>;

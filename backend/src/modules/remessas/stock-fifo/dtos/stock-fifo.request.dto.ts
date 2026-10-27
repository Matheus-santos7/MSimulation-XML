import { z } from "zod";

/** Query de GET /movimentacoes/saldo-cd. */
export const warehouseBalanceQuery = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
});

/** Body de POST /movimentacoes/remessa/realign-fifo. */
export const realignFifoBody = z.object({
  productSku: z.string().trim().min(1),
});

export type WarehouseBalanceQuery = z.infer<typeof warehouseBalanceQuery>;
export type RealignFifoBody = z.infer<typeof realignFifoBody>;

import { z } from "zod";

export const branchTransferItemBody = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
  quantidade: z.number().int().min(1),
});

/** Body de POST /movimentacoes/transferencia-filial. */
export const branchTransferBody = z.object({
  filialId: z.string().uuid(),
  items: z.array(branchTransferItemBody).min(1),
});

export type BranchTransferBody = z.infer<typeof branchTransferBody>;

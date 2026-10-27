import { z } from "zod";

export const shipmentItemBody = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
  quantidade: z.number().int().min(1),
});

/** Body de POST /movimentacoes/remessa. O marketplace vem do CD de destino. */
export const shipmentBody = z.object({
  unidadeDestinoId: z.string().uuid(),
  items: z.array(shipmentItemBody).min(1),
});

export type ShipmentBody = z.infer<typeof shipmentBody>;

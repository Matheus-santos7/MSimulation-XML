import { z } from "zod";

/** DTOs das rotas de movimentação (remessa, transferência, avanço, saldo, FIFO).*/

export const productMovementsQuery = z.object({
  productId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const warehouseBalanceQuery = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
});

export const advanceWarehouseBody = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
  quantidade: z.number().int().min(1),
  unidadeOrigemId: z.string().uuid(),
  unidadeDestinoId: z.string().uuid(),
});

export const manualShipmentItemBody = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
  quantidade: z.number().int().min(1),
});

export const manualShipmentBody = z.object({
  unidadeDestinoId: z.string().uuid(),
  items: z.array(manualShipmentItemBody).min(1),
});

export const transferenciaFilialItemBody = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
  quantidade: z.number().int().min(1),
});

export const transferenciaFilialBody = z.object({
  filialId: z.string().uuid(),
  items: z.array(transferenciaFilialItemBody).min(1),
});

export const realignFifoBody = z.object({
  productSku: z.string().trim().min(1),
});

import { z } from "zod";
import { digitsOnly, tenantCreateBody } from "./tenant.schemas.js";

const filialBaseFields = tenantCreateBody.omit({ ambiente: true, iest: true, codigoPais: true, nomePais: true });

export const tenantFilialCreateBody = filialBaseFields.extend({
  serieRemessa: z.coerce.number().int().min(1).max(999),
  serieTransferencia: z.coerce.number().int().min(1).max(999).optional(),
  unidadeLogisticaPadraoId: z.string().uuid().optional(),
});

export const tenantFilialUpdateBody = tenantFilialCreateBody.partial();

export const tenantFiscalRolesBody = z.object({
  emitenteRemessaId: z.string().uuid().nullable().optional(),
  emitenteTransferenciaId: z.string().uuid().nullable().optional(),
});

export const tenantFilialIdParam = z.object({
  id: z.string().uuid(),
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

export type TenantFilialCreateInput = z.infer<typeof tenantFilialCreateBody>;

export function normalizeFilialCnpj(cnpj: string): string {
  return digitsOnly(cnpj);
}

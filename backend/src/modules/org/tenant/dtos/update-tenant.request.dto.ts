import { z } from "zod";
import { createTenantRequestSchema } from "./create-tenant.request.dto.js";

/** PATCH parcial da empresa (sem defaults: campo ausente não muda). */
export const updateTenantRequestSchema = createTenantRequestSchema.partial().extend({
  emitenteFiscalPrincipal: z.boolean().optional(),
  emitenteFiscalMatriz: z.boolean().optional(),
});

export type UpdateTenantRequestDTO = z.infer<typeof updateTenantRequestSchema>;

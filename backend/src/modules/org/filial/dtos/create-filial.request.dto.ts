import { z } from "zod";
import { createTenantRequestSchema } from "../../tenant/dtos/create-tenant.request.dto.js";

/** Filial: os campos da empresa, sem ambiente, IE-ST e país, mais as séries e o CD padrão. */
const filialBaseFields = createTenantRequestSchema.omit({
  ambiente: true,
  iest: true,
  codigoPais: true,
  nomePais: true,
});

export const createFilialRequestSchema = filialBaseFields.extend({
  serieRemessa: z.coerce.number().int().min(1).max(999),
  serieTransferencia: z.coerce.number().int().min(1).max(999).optional(),
  unidadeLogisticaPadraoId: z.string().uuid().optional(),
});

export type CreateFilialRequestDTO = z.infer<typeof createFilialRequestSchema>;

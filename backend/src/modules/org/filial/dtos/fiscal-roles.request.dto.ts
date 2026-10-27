import { z } from "zod";

/** Estabelecimento que emite remessas e o que emite transferências (`null` = matriz). */
export const fiscalRolesRequestSchema = z.object({
  emitenteRemessaId: z.string().uuid().nullable().optional(),
  emitenteTransferenciaId: z.string().uuid().nullable().optional(),
});

export type FiscalRolesRequestDTO = z.infer<typeof fiscalRolesRequestSchema>;

import { z } from "zod";

export const logisticsUnitIdParam = z.object({
  id: z.string().uuid("ID de unidade inválido"),
});

export type LogisticsUnitParamsDTO = z.infer<typeof logisticsUnitIdParam>;

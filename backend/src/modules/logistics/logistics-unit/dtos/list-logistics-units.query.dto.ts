import { z } from "zod";
import { marketplaceCodeSchema } from "../../../marketplace/index.js";

/** Filtros da listagem de CDs (`?marketplace=` limita a um marketplace). */
export const logisticsUnitsListQuery = z.object({
  ativa: z.enum(["true", "false"]).optional(),
  q: z.string().optional(),
  cnpj: z.string().optional(),
  marketplace: marketplaceCodeSchema.optional(),
});

export type ListLogisticsUnitsQueryDTO = z.infer<typeof logisticsUnitsListQuery>;

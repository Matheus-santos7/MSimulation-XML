import { MARKETPLACE_CODES, type MarketplaceCode } from "@msimulation-xml/fiscal-core";
import { z } from "zod";

/** Filtros da listagem de CDs (`?marketplace=` limita a um marketplace). */
export const logisticsUnitsListQuery = z.object({
  ativa: z.enum(["true", "false"]).optional(),
  q: z.string().optional(),
  cnpj: z.string().optional(),
  marketplace: z.enum(MARKETPLACE_CODES as [MarketplaceCode, ...MarketplaceCode[]]).optional(),
});

export type ListLogisticsUnitsQueryDTO = z.infer<typeof logisticsUnitsListQuery>;

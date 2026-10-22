import { MARKETPLACE_CODES, type MarketplaceCode } from "@msimulation-xml/fiscal-core";
import { z } from "zod";

export const marketplaceParamsSchema = z.object({
  marketplace: z.enum(MARKETPLACE_CODES as [MarketplaceCode, ...MarketplaceCode[]], {
    errorMap: () => ({ message: "Marketplace inválido" }),
  }),
});

export type MarketplaceParamsDTO = z.infer<typeof marketplaceParamsSchema>;

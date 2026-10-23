import { MARKETPLACE_CODES, type MarketplaceCode } from "@msimulation-xml/fiscal-core";
import { z } from "zod";

/** Código de marketplace aceito em params, query e body (`MERCADO_LIVRE`, `SHOPEE`...). */
export const marketplaceCodeSchema = z.enum(
  MARKETPLACE_CODES as [MarketplaceCode, ...MarketplaceCode[]],
  { errorMap: () => ({ message: "Marketplace inválido" }) },
);

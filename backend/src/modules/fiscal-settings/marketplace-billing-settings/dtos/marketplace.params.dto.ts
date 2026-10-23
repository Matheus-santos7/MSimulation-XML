import { z } from "zod";
import { marketplaceCodeSchema } from "../../../marketplace/index.js";

export const marketplaceParamsSchema = z.object({
  marketplace: marketplaceCodeSchema,
});

export type MarketplaceParamsDTO = z.infer<typeof marketplaceParamsSchema>;

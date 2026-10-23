import { z } from "zod";
import { marketplaceCodeSchema } from "../../../marketplace/index.js";

/** Query de GET /timeline: `?marketplace=` mostra só os cenários daquele marketplace. */
export const timelineQuery = z.object({
  marketplace: marketplaceCodeSchema.optional(),
});

export type TimelineQuery = z.infer<typeof timelineQuery>;

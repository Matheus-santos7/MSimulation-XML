import { z } from "zod";
import { marketplaceCodeSchema } from "../../../marketplace/index.js";

/** Query de GET /nfes. */
export const listNfesQuery = z.object({
  marketplace: marketplaceCodeSchema.optional(),
});

export type ListNfesQuery = z.infer<typeof listNfesQuery>;

/** Query de GET /nfes/:chave/xml: `?doc=evento` (ou `cancelamento`) pede o evento. */
export type NfeXmlQuery = { download?: string; doc?: string };

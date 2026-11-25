import { z } from "zod";
import { paginationQuerySchema } from "../../../../nest/base/pagination.js";

/** `GET /products`: `offset`/`limit` paginam; `filter` busca no SKU e no nome. */
export const listProductsQuerySchema = paginationQuerySchema.pick({
  offset: true,
  limit: true,
  filter: true,
});

export type ListProductsQueryDTO = z.infer<typeof listProductsQuerySchema>;

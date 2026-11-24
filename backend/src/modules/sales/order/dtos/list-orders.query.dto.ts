import { z } from "zod";
import { paginationQuerySchema } from "../../../../nest/base/pagination.js";

/** `GET /pedidos`: `offset`/`limit` paginam (rascunhos primeiro, depois os mais recentes). */
export const listOrdersQuerySchema = paginationQuerySchema.pick({ offset: true, limit: true });

export type ListOrdersQueryDTO = z.infer<typeof listOrdersQuerySchema>;

import { z } from "zod";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export type PaginationParams = {
  page: number;
  perPage: number;
  sort?: string;
  filter?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

/** Query de listagem: `offset` é a página (default 1), `limit` o tamanho (default 10, teto 100). */
export const paginationQuerySchema = z.object({
  offset: z.coerce
    .number()
    .int("A página precisa ser um número inteiro")
    .min(1, "A página mínima é 1")
    .optional(),
  limit: z.coerce
    .number()
    .int("O tamanho da página precisa ser um número inteiro")
    .min(1, "O tamanho mínimo da página é 1")
    .optional(),
  sort: z.string().optional(),
  filter: z.string().optional(),
});

export type PaginationQueryDTO = z.infer<typeof paginationQuerySchema>;

/** Converte a query validada nos parâmetros do use case, aplicando defaults e o teto. */
export function toPaginationParams(query: PaginationQueryDTO): PaginationParams {
  return {
    page: query.offset ?? DEFAULT_PAGE,
    perPage: Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    ...(query.sort !== undefined && { sort: query.sort }),
    ...(query.filter !== undefined && { filter: query.filter }),
  };
}

import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

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
export class PaginationQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: "A página mínima é 1" })
  @IsInt({ message: "A página precisa ser um número inteiro" })
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: "O tamanho mínimo da página é 1" })
  @IsInt({ message: "O tamanho da página precisa ser um número inteiro" })
  limit?: number;

  @IsOptional()
  @IsString({ message: "A ordenação precisa ser um texto" })
  sort?: string;

  @IsOptional()
  @IsString({ message: "O filtro precisa ser um texto" })
  filter?: string;
}

/** Converte a query validada nos parâmetros do use case, aplicando defaults e o teto. */
export function toPaginationParams(query: PaginationQueryDTO): PaginationParams {
  return {
    page: query.offset ?? DEFAULT_PAGE,
    perPage: Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    ...(query.sort !== undefined && { sort: query.sort }),
    ...(query.filter !== undefined && { filter: query.filter }),
  };
}

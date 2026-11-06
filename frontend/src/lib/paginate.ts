/** Nome do parâmetro de URL da página; fica aqui (sem "use client") para o servidor poder importar. */
export const PAGE_PARAM = "pagina";

export type Page<T> = {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
};

/** Lê `?pagina=`: inteiro >= 1; qualquer outra coisa vira 1. */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** Fatia a lista em memória; página além da última vira a última. */
export function paginate<T>(list: readonly T[], requestedPage: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), page, totalPages, totalItems: list.length };
}

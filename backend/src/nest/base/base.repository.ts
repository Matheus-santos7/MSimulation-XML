import { getDbClient, type PrismaTransactionClient } from "../../lib/db/tenant-rls.js";
import { paginateQuery, type PaginatedResponse, type PaginationParams } from "./pagination.js";

export type PaginateQuery<TRow, TEntity> = {
  count: () => Promise<number>;
  findMany: (window: { skip: number; take: number }) => Promise<TRow[]>;
  restore: (row: TRow) => TEntity;
};

/**
 * Base dos repositories. O acesso ao banco é sempre `this.database`: a transação aberta pelo
 * `DbContextInterceptor`, com `app.tenant_id` aplicado (RLS). Filtre por `tenantId` mesmo assim.
 * O tipo gerado do Prisma não sai daqui: toda leitura passa por `Entity.restore`.
 */
export abstract class BaseRepository<TEntity> {
  protected get database(): PrismaTransactionClient {
    return getDbClient();
  }

  abstract getById(id: string, tenantId: string): Promise<TEntity | null>;

  protected paginate<TRow>(
    params: Pick<PaginationParams, "page" | "perPage">,
    query: PaginateQuery<TRow, TEntity>,
  ): Promise<PaginatedResponse<TEntity>> {
    return paginateQuery(params, { ...query, map: query.restore });
  }
}

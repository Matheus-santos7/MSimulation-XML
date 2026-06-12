import type { ProductMovement } from "../entities/product-movement.entity.js";

/** Filtros da listagem de movimentações. */
export type ListProductMovementsFilter = {
  productId?: string;
  limit?: number;
};

/**
 * Dados para registar movimentação após emissão fiscal (remessa, avanço, etc.).
 */
export type RegisterProductMovementData = {
  tenantId: string;
  productId: string;
  tipoOperacao: string;
  quantidade: number;
  nfeId: string;
  unidadeOrigemId?: string | null;
  unidadeDestinoId?: string | null;
  nfeSecundariaId?: string | null;
  observacao?: string | null;
};

/**
 * Port de leitura e escrita de movimentações de produto (`movimentacao_produto`).
 */
export interface ProductMovementRepository {
  listByTenant(tenantId: string, filter?: ListProductMovementsFilter): Promise<ProductMovement[]>;
  /**
   * Regista movimentação; aceita cliente Prisma ou transação (`db` opcional).
   */
  register(data: RegisterProductMovementData, db?: unknown): Promise<void>;
}

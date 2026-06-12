import type { ProductMovement } from "../entities/product-movement.entity.js";

export type ListProductMovementsFilter = {
  productId?: string;
  limit?: number;
};

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

export interface ProductMovementRepository {
  listByTenant(tenantId: string, filter?: ListProductMovementsFilter): Promise<ProductMovement[]>;
  /** Optional Prisma client or transaction (`PrismaClient | PrismaTx`). */
  register(data: RegisterProductMovementData, db?: unknown): Promise<void>;
}

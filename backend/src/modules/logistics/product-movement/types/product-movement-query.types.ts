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

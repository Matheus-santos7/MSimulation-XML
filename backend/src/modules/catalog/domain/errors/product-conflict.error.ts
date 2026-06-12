/**
 * Erro de conflito de negócio no catálogo (HTTP 409).
 *
 * Lançado quando a operação viola integridade ou histórico fiscal:
 * - SKU duplicado no tenant
 * - Exclusão com pedidos faturados vinculados
 * - FK de pedidos/movimentações impede remoção
 */
export class ProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductConflictError";
  }
}

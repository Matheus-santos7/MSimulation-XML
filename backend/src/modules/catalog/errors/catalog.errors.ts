import { BadRequestException, ConflictException } from "@nestjs/common";

/** Erros do catálogo de produtos. O filtro responde `{ error: message }` com o status. */
export namespace CatalogError {
  /**
   * Conflito de negócio (409): SKU duplicado na empresa, ou exclusão bloqueada por pedidos
   * faturados ou movimentações vinculadas.
   */
  export class ProductConflict extends ConflictException {}

  /** Campo fiscal ou comercial inválido (NCM, CEST, nFCI, regra fiscal, planilha) (400). */
  export class ProductInvalid extends BadRequestException {}
}

/** Erro de validação de campos do produto (NCM, CEST, preço, etc.). */
export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductValidationError";
  }
}

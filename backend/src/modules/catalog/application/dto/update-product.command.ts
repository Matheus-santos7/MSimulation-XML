import type { CreateProductCommand } from "./create-product.command.js";

/**
 * Comando de atualização parcial de produto.
 * Apenas os campos presentes no payload são alterados (PATCH).
 */
export type UpdateProductCommand = Partial<CreateProductCommand>;

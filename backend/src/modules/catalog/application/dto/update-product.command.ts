import type { CreateProductCommand } from "./create-product.command.js";

export type UpdateProductCommand = Partial<CreateProductCommand>;

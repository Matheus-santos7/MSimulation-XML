import { z } from "zod";
import { productBodyFields } from "./create-product.request.dto.js";

/** PATCH parcial do produto. */
export const updateProductRequestSchema = z.object(productBodyFields).partial();

export type UpdateProductRequestDTO = z.infer<typeof updateProductRequestSchema>;

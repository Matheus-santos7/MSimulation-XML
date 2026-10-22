import type { z } from "zod";
import { createFilialRequestSchema } from "./create-filial.request.dto.js";

export const updateFilialRequestSchema = createFilialRequestSchema.partial();

export type UpdateFilialRequestDTO = z.infer<typeof updateFilialRequestSchema>;

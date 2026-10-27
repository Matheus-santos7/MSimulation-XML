import { z } from "zod";

export const memberParamsSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

export type MemberParamsDTO = z.infer<typeof memberParamsSchema>;

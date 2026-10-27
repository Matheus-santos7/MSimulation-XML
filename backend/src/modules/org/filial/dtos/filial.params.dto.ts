import { z } from "zod";

export const filialParamsSchema = z.object({
  id: z.string().uuid(),
});

export type FilialParamsDTO = z.infer<typeof filialParamsSchema>;

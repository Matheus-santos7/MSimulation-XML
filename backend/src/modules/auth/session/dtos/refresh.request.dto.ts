import { z } from "zod";

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(20, "Refresh token inválido"),
});

export type RefreshRequestDTO = z.infer<typeof refreshRequestSchema>;

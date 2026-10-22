import { z } from "zod";

/** Corpo opcional do logout: refresh token inválido é ignorado (o logout sempre responde 204). */
export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(20, "Refresh token inválido").optional(),
});

export type LogoutRequestDTO = z.infer<typeof logoutRequestSchema>;

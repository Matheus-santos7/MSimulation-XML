import { z } from "zod";

export const tenantParamsSchema = z.object({
  id: z.string().uuid(),
});

export type TenantParamsDTO = z.infer<typeof tenantParamsSchema>;

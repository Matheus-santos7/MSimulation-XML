import { z } from "zod";

export const fiscalEmitterSettingsPatchBody = z
  .object({
    basic: z.record(z.string(), z.unknown()).optional(),
    taxes: z.record(z.string(), z.unknown()).optional(),
    nfe: z.record(z.string(), z.unknown()).optional(),
    serieRemessa: z.number().int().min(1).max(999).optional(),
    serieCte: z.number().int().min(1).max(999).optional(),
  })
  .strict();

export const fiscalSettingsTenantQuery = z.object({
  tenantId: z.string().uuid(),
});

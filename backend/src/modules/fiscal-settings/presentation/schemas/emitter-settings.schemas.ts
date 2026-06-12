import { z } from "zod";

export const updateEmitterSettingsBodySchema = z
  .object({
    basic: z.record(z.string(), z.unknown()).optional(),
    taxes: z.record(z.string(), z.unknown()).optional(),
    nfe: z.record(z.string(), z.unknown()).optional(),
    serieRemessa: z.number().int().min(1).max(999).optional(),
    serieCte: z.number().int().min(1).max(999).optional(),
  })
  .strict();

/** @deprecated Use updateEmitterSettingsBodySchema */
export const fiscalEmitterSettingsPatchBody = updateEmitterSettingsBodySchema;

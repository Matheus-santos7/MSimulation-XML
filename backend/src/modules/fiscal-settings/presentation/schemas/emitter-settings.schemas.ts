import { z } from "zod";

/**
 * Schema Zod do body `PATCH /fiscal-settings`.
 *
 * Secções opcionais `basic`, `taxes`, `nfe` aceitam objetos JSON parciais;
 * séries são inteiros 1–999 no `tenant`.
 */
export const updateEmitterSettingsBodySchema = z
  .object({
    basic: z.record(z.string(), z.unknown()).optional(),
    taxes: z.record(z.string(), z.unknown()).optional(),
    nfe: z.record(z.string(), z.unknown()).optional(),
    serieRemessa: z.number().int().min(1).max(999).optional(),
    serieTransferencia: z.number().int().min(1).max(999).optional(),
    serieCte: z.number().int().min(1).max(999).optional(),
  })
  .strict();

/** @deprecated Use updateEmitterSettingsBodySchema */
export const fiscalEmitterSettingsPatchBody = updateEmitterSettingsBodySchema;

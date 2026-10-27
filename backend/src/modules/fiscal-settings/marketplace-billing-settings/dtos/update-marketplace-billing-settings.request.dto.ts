import { z } from "zod";

/**
 * Sobrescrita do faturador para um marketplace (substitui a anterior). `{}` volta a herdar
 * tudo do padrão da empresa.
 */
export const updateMarketplaceBillingSettingsRequestSchema = z
  .object({
    basic: z.record(z.string(), z.unknown()).optional(),
    taxes: z.record(z.string(), z.unknown()).optional(),
    nfe: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type UpdateMarketplaceBillingSettingsRequestDTO = z.infer<
  typeof updateMarketplaceBillingSettingsRequestSchema
>;

import { z } from "zod";

export const taxRuleImportRowSchema = z.object({
  ruleId: z.string().min(1),
  nome: z.string().min(1),
  tipo: z.string().min(1),
  uf: z.string().length(2),
  cfop: z.string().optional().default(""),
  aliquota: z.string().optional().default(""),
  transactionType: z.string().optional(),
  customerType: z.string().optional(),
  origin: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

export const taxRulesBulkBodySchema = z.object({
  rows: z.array(taxRuleImportRowSchema).min(1).max(5000),
});

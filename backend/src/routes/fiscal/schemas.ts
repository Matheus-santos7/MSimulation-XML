import { z } from "zod";

export const chaveParamSchema = z.object({
  chave: z.string().length(44),
});

export const cancelamentoBodySchema = z.object({
  xJust: z.string().min(15).max(255).optional(),
});

export const inutilizarBodySchema = z.object({
  serie: z.number().int().positive(),
  numeroIni: z.number().int().positive(),
  numeroFim: z.number().int().positive(),
  xJust: z.string().min(15).max(255).optional(),
});

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

export const taxRuleBaseIdParamSchema = z.object({
  baseId: z
    .string()
    .trim()
    .min(1, "Identificador da regra inválido")
    .max(200)
    .regex(/^[A-Za-z0-9._-]+$/, "Identificador da regra inválido"),
});

export const taxRuleGroupQuerySchema = z.object({
  origin: z.string().trim().min(2).max(2),
});

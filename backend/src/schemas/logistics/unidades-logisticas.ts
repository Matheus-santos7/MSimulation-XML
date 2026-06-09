import { z } from "zod";

export const importRowSchema = z.object({
  unidade: z.string().min(1),
  cnpj: z.union([z.string(), z.number()]),
  inscricaoEstadual: z.union([z.string(), z.number()]).optional(),
  idCadIntTran: z.union([z.string(), z.number(), z.null()]).optional(),
  logradouro: z.string(),
  numero: z.string(),
  cidade: z.string(),
  uf: z.string().min(2).max(2),
  cep: z.union([z.string(), z.number()]),
});

export const unidadesListQuery = z.object({
  ativa: z.enum(["true", "false"]).optional(),
  q: z.string().optional(),
  cnpj: z.string().optional(),
});

export const movimentacoesQuery = z.object({
  productId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const saldoCdQuery = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
});

export const avancoCdBody = z.object({
  productId: z.string().uuid(),
  productSku: z.string().trim().min(1).optional(),
  quantidade: z.number().int().min(1),
  unidadeOrigemId: z.string().uuid(),
  unidadeDestinoId: z.string().uuid(),
});

export const remessaManualItemBody = z.object({
  productId: z.string().uuid(),
  quantidade: z.number().int().min(1),
});

export const remessaManualBody = z.object({
  unidadeDestinoId: z.string().uuid(),
  items: z.array(remessaManualItemBody).min(1),
});

export const unidadeIdParam = z.object({
  id: z.string().uuid("ID de unidade inválido"),
});

export const bulkImportJsonBody = z.object({
  rows: z.array(importRowSchema).min(1),
  enrichCep: z.boolean().optional(),
});

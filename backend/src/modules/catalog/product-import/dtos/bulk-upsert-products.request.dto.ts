import { z } from "zod";

/** Linha bruta da planilha; a validação fiscal fica no BulkUpsertProductsUseCase. */
export const productImportRawRowSchema = z.object({
  line: z.number().int().positive(),
  sku: z.string(),
  ean: z.string().optional(),
  nome: z.string(),
  ncm: z.string(),
  cest: z.string().optional(),
  exTipi: z.string().optional(),
  origem: z.union([z.string(), z.number()]).optional(),
  nfci: z.string().optional(),
  unidade: z.string().optional(),
  preco: z.union([z.string(), z.number()]),
  precoCusto: z.union([z.string(), z.number()]),
  estoque: z.union([z.string(), z.number()]).optional(),
  taxRuleBaseId: z.string().optional(),
});

export const bulkUpsertProductsRequestSchema = z.object({
  rows: z
    .array(productImportRawRowSchema)
    .min(1, "Planilha vazia")
    .max(500, "Máximo de 500 linhas por importação"),
});

export type BulkUpsertProductsRequestDTO = z.infer<typeof bulkUpsertProductsRequestSchema>;
export type ProductImportRawRowInput = z.infer<typeof productImportRawRowSchema>;

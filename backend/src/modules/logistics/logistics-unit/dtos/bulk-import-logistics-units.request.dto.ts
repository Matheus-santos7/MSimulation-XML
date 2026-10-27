import { z } from "zod";

/** Linha da planilha de CDs do Mercado Livre (também aceita como JSON). */
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

/** Importação por JSON (a planilha XLSX vai por multipart). */
export const bulkImportJsonBody = z.object({
  rows: z.array(importRowSchema).min(1),
  enrichCep: z.boolean().optional(),
});

export type BulkImportLogisticsUnitsRequestDTO = z.infer<typeof bulkImportJsonBody>;

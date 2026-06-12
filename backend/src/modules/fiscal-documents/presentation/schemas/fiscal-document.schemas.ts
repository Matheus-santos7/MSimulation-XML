import { z } from "zod";

export const nfeAccessKeyParamSchema = z.object({
  chave: z.string().length(44),
});

/** @deprecated Use nfeAccessKeyParamSchema */
export const chaveParamSchema = nfeAccessKeyParamSchema;

export const cancelDocumentBodySchema = z.object({
  xJust: z.string().min(15).max(255).optional(),
});

/** @deprecated Use cancelDocumentBodySchema */
export const cancelamentoBodySchema = cancelDocumentBodySchema;

export const inutilizeNumberBodySchema = z.object({
  serie: z.number().int().positive(),
  numeroIni: z.number().int().positive(),
  numeroFim: z.number().int().positive(),
  xJust: z.string().min(15).max(255).optional(),
});

/** @deprecated Use inutilizeNumberBodySchema */
export const inutilizarBodySchema = inutilizeNumberBodySchema;

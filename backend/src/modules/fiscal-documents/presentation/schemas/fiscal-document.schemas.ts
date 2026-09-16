import { z } from "zod";

export const nfeAccessKeyParamSchema = z.object({
  chave: z.string().length(44),
});

export const cancelDocumentBodySchema = z.object({
  xJust: z.string().min(15).max(255).optional(),
});

/** Devolução parcial: linhas (`nItem` da venda) e quantidades. Sem `itens` = tudo que resta. */
export const processReturnBodySchema = z.object({
  itens: z
    .array(
      z.object({
        numeroItem: z.number().int().positive(),
        quantidade: z.number().int().positive(),
      }),
    )
    .max(990)
    .optional(),
});

export const inboundConferenceBodySchema = z.object({
  receivedQty: z.number().finite().nonnegative(),
  positiveCfopOverride: z.string().length(4).optional().nullable(),
  negativeCfopOverride: z.string().length(4).optional().nullable(),
});

export const inutilizeNumberBodySchema = z.object({
  serie: z.number().int().positive(),
  numeroIni: z.number().int().positive(),
  numeroFim: z.number().int().positive(),
  xJust: z.string().min(15).max(255).optional(),
});

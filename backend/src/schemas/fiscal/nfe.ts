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

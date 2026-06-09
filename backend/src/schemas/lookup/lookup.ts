import { z } from "zod";

export const cnpjParamSchema = z.object({
  cnpj: z.string().min(14).max(18),
});

export const cepParamSchema = z.object({
  cep: z.string().min(8).max(9),
});

import { z } from "zod";
import { optionalBody } from "../../shared/dtos/access-key.request.dto.js";

const MAX_RETURN_LINES = 990;

/** Body de POST /nfes/:chave/devolucao. Linhas (`nItem` da venda); sem `itens` = tudo que resta. */
export const saleReturnBody = optionalBody(
  z.object({
    itens: z
      .array(
        z.object({
          numeroItem: z.number().int().positive(),
          quantidade: z.number().int().positive(),
        }),
      )
      .max(MAX_RETURN_LINES)
      .optional(),
  }),
);

export type SaleReturnBody = z.infer<typeof saleReturnBody>;

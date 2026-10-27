import { z } from "zod";
import { optionalBody } from "../../shared/dtos/access-key.request.dto.js";

/** Body de POST /nfes/inutilizar. */
export const numberInutilizationBody = optionalBody(
  z.object({
    serie: z.number().int().positive(),
    numeroIni: z.number().int().positive(),
    numeroFim: z.number().int().positive(),
    xJust: z.string().min(15).max(255).optional(),
  }),
);

export type NumberInutilizationBody = z.infer<typeof numberInutilizationBody>;

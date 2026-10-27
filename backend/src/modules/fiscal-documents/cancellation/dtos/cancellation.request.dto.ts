import { z } from "zod";
import { optionalBody } from "../../shared/dtos/access-key.request.dto.js";

/** Body de POST /nfes/:chave/cancelamento. */
export const cancellationBody = optionalBody(
  z.object({
    xJust: z.string().min(15).max(255).optional(),
  }),
);

export type CancellationBody = z.infer<typeof cancellationBody>;

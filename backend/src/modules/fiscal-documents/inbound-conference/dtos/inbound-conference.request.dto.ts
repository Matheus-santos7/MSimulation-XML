import { z } from "zod";
import { optionalBody } from "../../shared/dtos/access-key.request.dto.js";

const CFOP_LENGTH = 4;

/** Body de POST /nfes/:chave/conferencia. */
export const inboundConferenceBody = optionalBody(
  z.object({
    receivedQty: z.number().finite().nonnegative(),
    positiveCfopOverride: z.string().length(CFOP_LENGTH).optional().nullable(),
    negativeCfopOverride: z.string().length(CFOP_LENGTH).optional().nullable(),
  }),
);

export type InboundConferenceBody = z.infer<typeof inboundConferenceBody>;

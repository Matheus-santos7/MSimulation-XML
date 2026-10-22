import { strictRouteRateLimit } from "../../../../lib/http/rate-limit.js";

/** Rate limit das rotas de lookup (anti-abuso do proxy para APIs externas de CNPJ/CEP). */
export const lookupRouteRateLimit = strictRouteRateLimit(30, "1 minute");

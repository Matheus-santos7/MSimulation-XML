import { Controller, Get, Inject, Param, UseInterceptors } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { strictRouteRateLimit } from "../../lib/http/rate-limit.js";
import { AuthenticatedApi } from "../../nest/api-access.decorators.js";
import { RateLimit, RateLimitInterceptor } from "../../nest/http/rate-limit.interceptor.js";
import { CepLookupResponseDTO } from "./dtos/cep-lookup.response.dto.js";
import { CnpjLookupResponseDTO } from "./dtos/cnpj-lookup.response.dto.js";
import { LookupService } from "./lookup.service.js";

/** Anti-abuso do proxy para APIs públicas: 30 consultas/min por rota e por IP (403 ao estourar). */
export const LOOKUP_RATE_LIMIT = strictRouteRateLimit(30, "1 minute");

/**
 * Lookup CNPJ/CEP: só JWT, sem tenant (onboarding) e sem transação.
 * O limite é contado depois do JWT.
 */
@Controller("lookup")
@ApiTags("lookup")
@AuthenticatedApi()
@UseInterceptors(RateLimitInterceptor)
@RateLimit(LOOKUP_RATE_LIMIT)
export class LookupController {
  constructor(@Inject(LookupService) private readonly lookupService: LookupService) {}

  @Get("cnpj/:cnpj")
  @ApiResponse({ status: 200, type: CnpjLookupResponseDTO })
  cnpj(@Param("cnpj") cnpj: string): Promise<CnpjLookupResponseDTO> {
    return this.lookupService.lookupCnpj(cnpj);
  }

  @Get("cep/:cep")
  @ApiResponse({ status: 200, type: CepLookupResponseDTO })
  cep(@Param("cep") cep: string): Promise<CepLookupResponseDTO> {
    return this.lookupService.lookupCep(cep);
  }
}

import { Body, Controller, Get, Inject, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import {
  nfeNumeracaoQuerySchema,
  type NfeNumeracaoQueryDTO,
} from "./dtos/nfe-numeracao.query.dto.js";
import {
  updateEmitterSettingsRequestSchema,
  type UpdateEmitterSettingsRequestDTO,
} from "./dtos/update-emitter-settings.request.dto.js";
import { EmitterSettingsService } from "./emitter-settings.service.js";

/**
 * Configuração padrão do emissor fiscal da empresa.
 *
 * | Método | Rota | Service |
 * |--------|------|---------|
 * | GET | `/fiscal-settings` | get |
 * | GET | `/fiscal-settings/nfe-numeracao` | numeracaoPreview |
 * | PATCH | `/fiscal-settings` | update (ADMIN) |
 */
@Controller("fiscal-settings")
@ApiTags("fiscal-settings")
@ProtectedApi()
export class EmitterSettingsController {
  constructor(@Inject(EmitterSettingsService) private readonly settings: EmitterSettingsService) {}

  @Get("nfe-numeracao")
  nfeNumeracao(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(nfeNumeracaoQuerySchema)) query: NfeNumeracaoQueryDTO,
  ) {
    return this.settings.numeracaoPreview(tenantId, query.serie, query.numeroInicial);
  }

  @Get()
  get(@TenantId() tenantId: string) {
    return this.settings.get(tenantId);
  }

  @Patch()
  @AdminOnly()
  update(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateEmitterSettingsRequestSchema))
    body: UpdateEmitterSettingsRequestDTO,
  ) {
    return this.settings.update(tenantId, body);
  }
}

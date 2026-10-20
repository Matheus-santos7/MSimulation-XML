import { Body, Controller, Get, Inject, Patch, Query } from "@nestjs/common";
import type { z } from "zod";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { FISCAL_SETTINGS, type FiscalSettingsContext } from "../../fiscal-settings.tokens.js";
import { nfeNumeracaoQuerySchema, updateEmitterSettingsBodySchema } from "../schemas/emitter-settings.schemas.js";

const TENANT_NOT_FOUND = "Empresa não encontrada";

/**
 * Controller HTTP de configurações do emissor fiscal.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/fiscal-settings` | GetEmitterSettingsUseCase |
 * | GET | `/fiscal-settings/nfe-numeracao` | GetNfeNumeracaoPreviewUseCase |
 * | PATCH | `/fiscal-settings` | UpdateEmitterSettingsUseCase (ADMIN) |
 */
@Controller("fiscal-settings")
@ProtectedApi()
export class EmitterSettingsController {
  constructor(@Inject(FISCAL_SETTINGS) private readonly fiscalSettings: FiscalSettingsContext) {}

  @Get("nfe-numeracao")
  async nfeNumeracao(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(nfeNumeracaoQuerySchema)) query: z.infer<typeof nfeNumeracaoQuerySchema>,
  ) {
    const preview = await this.fiscalSettings.getNfeNumeracaoPreview.execute(
      tenantId,
      query.serie,
      query.numeroInicial,
    );

    return orNotFound(preview, TENANT_NOT_FOUND);
  }

  @Get()
  async get(@TenantId() tenantId: string) {
    return orNotFound(await this.fiscalSettings.getEmitterSettings.execute(tenantId), TENANT_NOT_FOUND);
  }

  @Patch()
  @AdminOnly()
  async update(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateEmitterSettingsBodySchema))
    body: z.infer<typeof updateEmitterSettingsBodySchema>,
  ) {
    return orNotFound(await this.fiscalSettings.updateEmitterSettings.execute(tenantId, body), TENANT_NOT_FOUND);
  }
}

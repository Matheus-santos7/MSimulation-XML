import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import {
  createFilialRequestSchema,
  type CreateFilialRequestDTO,
} from "./dtos/create-filial.request.dto.js";
import { filialParamsSchema, type FilialParamsDTO } from "./dtos/filial.params.dto.js";
import {
  fiscalRolesRequestSchema,
  type FiscalRolesRequestDTO,
} from "./dtos/fiscal-roles.request.dto.js";
import {
  updateFilialRequestSchema,
  type UpdateFilialRequestDTO,
} from "./dtos/update-filial.request.dto.js";
import { FilialService } from "./filial.service.js";
import { SetFiscalRolesUseCase } from "./use-cases/set-fiscal-roles.usecase.js";

const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const INVALID_PAYLOAD = "Payload inválido";

/**
 * Filiais e papéis fiscais da empresa (matriz).
 *
 * | Método | Rota | Destino |
 * |--------|------|---------|
 * | GET | `/empresas/filiais` | FilialService.list |
 * | POST | `/empresas/filiais` | FilialService.add (ADMIN) |
 * | PUT | `/empresas/filiais/:id` | FilialService.update (ADMIN) |
 * | DELETE | `/empresas/filiais/:id` | FilialService.remove (ADMIN) |
 * | PATCH | `/empresas/papeis-fiscais` | SetFiscalRolesUseCase (ADMIN) |
 * | GET | `/filiais` | FilialService.list (rota legada) |
 */
@Controller()
@ApiTags("filiais")
@ProtectedApi()
export class FilialController {
  constructor(
    @Inject(FilialService) private readonly filialService: FilialService,
    @Inject(SetFiscalRolesUseCase) private readonly setFiscalRoles: SetFiscalRolesUseCase,
  ) {}

  @Get("empresas/filiais")
  list(@TenantId() tenantId: string) {
    return this.filialService.list(tenantId);
  }

  @Post("empresas/filiais")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createFilialRequestSchema, { invalidMessage: INVALID_PAYLOAD }))
    body: CreateFilialRequestDTO,
  ) {
    return this.filialService.add(tenantId, body);
  }

  @Put("empresas/filiais/:id")
  @AdminOnly()
  update(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(filialParamsSchema)) params: FilialParamsDTO,
    @Body(new ZodValidationPipe(updateFilialRequestSchema, { invalidMessage: INVALID_PAYLOAD }))
    body: UpdateFilialRequestDTO,
  ) {
    return this.filialService.update(tenantId, params.id, body);
  }

  @Delete("empresas/filiais/:id")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  remove(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(filialParamsSchema)) params: FilialParamsDTO,
  ) {
    return this.filialService.remove(tenantId, params.id);
  }

  @Patch("empresas/papeis-fiscais")
  @AdminOnly()
  updateFiscalRoles(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(fiscalRolesRequestSchema, { invalidMessage: INVALID_PAYLOAD }))
    body: FiscalRolesRequestDTO,
  ) {
    return this.setFiscalRoles.execute(tenantId, body);
  }

  /** Compatibilidade com a rota legada `/filiais`. */
  @Get("filiais")
  listLegacy(@TenantId() tenantId: string) {
    return this.filialService.list(tenantId);
  }
}

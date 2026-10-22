import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { tenantParamsSchema, type TenantParamsDTO } from "./dtos/tenant.params.dto.js";
import { updateTenantRequestSchema } from "./dtos/update-tenant.request.dto.js";
import { TenantService } from "./tenant.service.js";

/**
 * Empresa emitente (tenant) do usuário autenticado.
 *
 * Criação é pelo onboarding (`/auth/onboarding/tenant`) e exclusão não é permitida.
 *
 * | Método | Rota | Service |
 * |--------|------|---------|
 * | GET | `/tenants` | listOwn (array com 1 item) |
 * | GET | `/tenants/:id` | getOwn |
 * | POST | `/tenants` | 403 |
 * | PATCH | `/tenants/:id` | update |
 * | DELETE | `/tenants/:id` | 403 |
 */
@Controller("tenants")
@ApiTags("tenants")
@ProtectedApi()
export class TenantController {
  constructor(@Inject(TenantService) private readonly tenantService: TenantService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.tenantService.listOwn(tenantId);
  }

  @Get(":id")
  get(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(tenantParamsSchema)) params: TenantParamsDTO,
  ) {
    return this.tenantService.getOwn(params.id, tenantId);
  }

  @Post()
  create(): never {
    throw new ForbiddenException("Cadastro de empresas não disponível via API autenticada");
  }

  @Patch(":id")
  update(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(tenantParamsSchema)) params: TenantParamsDTO,
    @Body() rawBody: unknown,
  ) {
    this.tenantService.assertOwnTenant(params.id, tenantId);
    // Corpo validado depois da checagem de tenant: id alheio responde 404 mesmo com corpo inválido.
    const body = updateTenantRequestSchema.parse(rawBody);

    return this.tenantService.update(params.id, body);
  }

  @Delete(":id")
  remove(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(tenantParamsSchema)) params: TenantParamsDTO,
  ): never {
    this.tenantService.assertOwnTenant(params.id, tenantId);

    throw new ForbiddenException("Exclusão de empresa não permitida");
  }
}

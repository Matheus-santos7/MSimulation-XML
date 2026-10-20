import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseFilters } from "@nestjs/common";
import type { z } from "zod";
import { HttpError } from "../../../../lib/http/http-error.js";
import { ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../../nest/http/api-exception.filter.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { TenantConflictError } from "../../domain/errors/tenant-conflict.error.js";
import { ORG, type OrgContext } from "../../org.tokens.js";
import { tenantIdParam, tenantUpdateBody } from "../schemas/tenant.schemas.js";

const HTTP_FORBIDDEN = 403;
const TENANT_NOT_FOUND = "Empresa não encontrada";

type TenantIdParam = z.infer<typeof tenantIdParam>;

/** Outro `:id` que não o tenant do JWT responde 404, como se a empresa não existisse. */
function assertOwnTenant(id: string, tenantId: string): void {
  orNotFound(id === tenantId, TENANT_NOT_FOUND);
}

/**
 * Controller HTTP de gestão da empresa emitente (tenant).
 *
 * Segurança: o utilizador só acede ao **próprio** tenant do JWT (`@TenantId()`).
 * Pedidos a outro `:id` devolvem 404. Criação e exclusão estão bloqueadas na API
 * (onboarding via `auth`; exclusão não permitida).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/tenants` | GetTenantByIdUseCase (array com 1 item) |
 * | GET | `/tenants/:id` | GetTenantByIdUseCase |
 * | POST | `/tenants` | 403 — usar onboarding auth |
 * | PATCH | `/tenants/:id` | UpdateTenantUseCase |
 * | DELETE | `/tenants/:id` | 403 — exclusão não permitida |
 */
@Controller("tenants")
@ProtectedApi()
@UseFilters(new RouteErrorFilter({ mappings: [{ type: TenantConflictError, status: 409 }] }))
export class TenantController {
  constructor(@Inject(ORG) private readonly org: OrgContext) {}

  /** Só o tenant do JWT, com filiais (a UI espera um array). */
  @Get()
  async list(@TenantId() tenantId: string) {
    const tenant = await this.org.tenantRepository.findByIdWithFiliais(tenantId);

    return tenant ? [tenant] : [];
  }

  @Get(":id")
  async get(@TenantId() tenantId: string, @Param(new ZodValidationPipe(tenantIdParam)) params: TenantIdParam) {
    assertOwnTenant(params.id, tenantId);

    return orNotFound(await this.org.tenantRepository.findByIdWithFiliais(params.id), TENANT_NOT_FOUND);
  }

  @Post()
  create(): never {
    throw new HttpError(HTTP_FORBIDDEN, "Cadastro de empresas não disponível via API autenticada");
  }

  @Patch(":id")
  async update(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(tenantIdParam)) params: TenantIdParam,
    @Body() rawBody: unknown,
  ) {
    assertOwnTenant(params.id, tenantId);
    // Corpo validado depois da checagem de tenant: id alheio responde 404 mesmo com corpo inválido.
    const body = tenantUpdateBody.parse(rawBody);
    orNotFound(await this.org.updateTenant.execute(params.id, body), TENANT_NOT_FOUND);

    return this.org.tenantRepository.findByIdWithFiliais(params.id);
  }

  @Delete(":id")
  remove(@TenantId() tenantId: string, @Param(new ZodValidationPipe(tenantIdParam)) params: TenantIdParam): never {
    assertOwnTenant(params.id, tenantId);

    throw new HttpError(HTTP_FORBIDDEN, "Exclusão de empresa não permitida");
  }
}

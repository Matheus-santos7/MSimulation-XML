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
  UseFilters,
} from "@nestjs/common";
import type { z } from "zod";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../../nest/http/api-exception.filter.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { TenantFilialError } from "../../domain/errors/tenant-filial.error.js";
import { ORG, type OrgContext } from "../../org.tokens.js";
import {
  normalizeFilialCnpj,
  tenantFilialCreateBody,
  tenantFilialIdParam,
  tenantFilialUpdateBody,
  tenantFiscalRolesBody,
} from "../schemas/tenant-filial.schemas.js";

const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const INVALID_PAYLOAD = "Payload inválido";
const FILIAL_NOT_FOUND = "Filial não encontrada";

type FilialCreateBody = z.infer<typeof tenantFilialCreateBody>;
type FilialUpdateBody = z.infer<typeof tenantFilialUpdateBody>;
type FilialIdParam = z.infer<typeof tenantFilialIdParam>;

function toFilialCreate(body: FilialCreateBody) {
  return {
    razaoSocial: body.razaoSocial,
    nomeFantasia: body.nomeFantasia,
    cnpj: normalizeFilialCnpj(body.cnpj),
    ie: body.ie,
    crt: body.crt,
    logradouro: body.logradouro,
    numero: body.numero,
    complemento: body.complemento,
    bairro: body.bairro,
    codigoMunicipio: body.codigoMunicipio,
    municipio: body.municipio,
    uf: body.uf.toUpperCase(),
    cep: body.cep,
    telefone: body.telefone,
    serieRemessa: body.serieRemessa,
    serieTransferencia: body.serieTransferencia,
    unidadeLogisticaPadraoId: body.unidadeLogisticaPadraoId,
  };
}

/** Só os campos enviados; `null` limpa os opcionais (complemento, telefone, série de transferência, CD padrão). */
function toFilialUpdate(body: FilialUpdateBody) {
  return {
    ...(body.razaoSocial != null ? { razaoSocial: body.razaoSocial } : {}),
    ...(body.nomeFantasia != null ? { nomeFantasia: body.nomeFantasia } : {}),
    ...(body.cnpj != null ? { cnpj: normalizeFilialCnpj(body.cnpj) } : {}),
    ...(body.ie != null ? { ie: body.ie } : {}),
    ...(body.crt != null ? { crt: body.crt } : {}),
    ...(body.logradouro != null ? { logradouro: body.logradouro } : {}),
    ...(body.numero != null ? { numero: body.numero } : {}),
    ...(body.complemento !== undefined ? { complemento: body.complemento } : {}),
    ...(body.bairro != null ? { bairro: body.bairro } : {}),
    ...(body.codigoMunicipio != null ? { codigoMunicipio: body.codigoMunicipio } : {}),
    ...(body.municipio != null ? { municipio: body.municipio } : {}),
    ...(body.uf != null ? { uf: body.uf.toUpperCase() } : {}),
    ...(body.cep != null ? { cep: body.cep } : {}),
    ...(body.telefone !== undefined ? { telefone: body.telefone } : {}),
    ...(body.serieRemessa != null ? { serieRemessa: body.serieRemessa } : {}),
    ...(body.serieTransferencia !== undefined
      ? { serieTransferencia: body.serieTransferencia }
      : {}),
    ...(body.unidadeLogisticaPadraoId !== undefined
      ? { unidadeLogisticaPadraoId: body.unidadeLogisticaPadraoId }
      : {}),
  };
}

/**
 * Gestão de filiais e papéis fiscais da empresa (matriz).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/empresas/filiais` | ListTenantFiliaisUseCase |
 * | POST | `/empresas/filiais` | AddTenantFilialUseCase (ADMIN) |
 * | PUT | `/empresas/filiais/:id` | UpdateTenantFilialUseCase (ADMIN) |
 * | DELETE | `/empresas/filiais/:id` | RemoveTenantFilialUseCase (ADMIN) |
 * | PATCH | `/empresas/papeis-fiscais` | SetTenantFiscalRolesUseCase (ADMIN) |
 * | GET | `/filiais` | ListTenantFiliaisUseCase (rota legada) |
 */
@Controller()
@ProtectedApi()
@UseFilters(new RouteErrorFilter({ mappings: [{ type: TenantFilialError, status: 400 }] }))
export class TenantFilialController {
  constructor(@Inject(ORG) private readonly org: OrgContext) {}

  @Get("empresas/filiais")
  list(@TenantId() tenantId: string) {
    return this.org.listTenantFiliais.execute(tenantId);
  }

  @Post("empresas/filiais")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(tenantFilialCreateBody, { invalidMessage: INVALID_PAYLOAD }))
    body: FilialCreateBody,
  ) {
    return this.org.addTenantFilial.execute(tenantId, toFilialCreate(body));
  }

  @Put("empresas/filiais/:id")
  @AdminOnly()
  async update(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(tenantFilialIdParam)) params: FilialIdParam,
    @Body(new ZodValidationPipe(tenantFilialUpdateBody, { invalidMessage: INVALID_PAYLOAD }))
    body: FilialUpdateBody,
  ) {
    const row = await this.org.updateTenantFilial.execute(
      tenantId,
      params.id,
      toFilialUpdate(body),
    );

    return orNotFound(row, FILIAL_NOT_FOUND);
  }

  @Delete("empresas/filiais/:id")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(tenantFilialIdParam)) params: FilialIdParam,
  ) {
    orNotFound(await this.org.removeTenantFilial.execute(tenantId, params.id), FILIAL_NOT_FOUND);
  }

  @Patch("empresas/papeis-fiscais")
  @AdminOnly()
  async setFiscalRoles(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(tenantFiscalRolesBody, { invalidMessage: INVALID_PAYLOAD }))
    body: z.infer<typeof tenantFiscalRolesBody>,
  ) {
    const tenant = await this.org.setTenantFiscalRoles.execute(tenantId, body);

    return this.org.tenantRepository.findByIdWithFiliais(tenant.id);
  }

  /** Compatibilidade com a rota legada `/filiais`. */
  @Get("filiais")
  listLegacy(@TenantId() tenantId: string) {
    return this.org.listTenantFiliais.execute(tenantId);
  }
}

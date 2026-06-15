import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { TenantFilialError } from "../../domain/errors/tenant-filial.error.js";
import { createOrgModule } from "../../infrastructure/factory/org-module.factory.js";
import {
  tenantFilialCreateBody,
  tenantFilialIdParam,
  tenantFilialUpdateBody,
  tenantFiscalRolesBody,
  normalizeFilialCnpj,
} from "../schemas/tenant-filial.schemas.js";

const TENANT_FILIAL_ERROR_MAPPINGS = [{ type: TenantFilialError, status: 400 }] as const;

/**
 * Gestão de filiais e papéis fiscais da empresa (matriz).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/empresas/filiais` | ListTenantFiliaisUseCase |
 * | POST | `/empresas/filiais` | AddTenantFilialUseCase |
 * | PUT | `/empresas/filiais/:id` | UpdateTenantFilialUseCase |
 * | DELETE | `/empresas/filiais/:id` | RemoveTenantFilialUseCase |
 * | PATCH | `/empresas/papeis-fiscais` | SetTenantFiscalRolesUseCase |
 */
export const tenantFilialController: FastifyPluginAsync = async (app) => {
  const org = createOrgModule();

  app.get("/empresas/filiais", async (request) => {
    const tenantId = tenantIdFromRequest(request);
    return org.listTenantFiliais.execute(tenantId);
  });

  app.post("/empresas/filiais", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const parsed = tenantFilialCreateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    try {
      return await org.addTenantFilial.execute(tenantId, {
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
      });
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TENANT_FILIAL_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.put("/empresas/filiais/:id", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = tenantFilialIdParam.parse(request.params);
    const parsed = tenantFilialUpdateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    try {
      const row = await org.updateTenantFilial.execute(tenantId, id, {
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
        ...(body.serieTransferencia !== undefined ? { serieTransferencia: body.serieTransferencia } : {}),
        ...(body.unidadeLogisticaPadraoId !== undefined
          ? { unidadeLogisticaPadraoId: body.unidadeLogisticaPadraoId }
          : {}),
      });
      if (!row) return reply.status(404).send({ error: "Filial não encontrada" });
      return row;
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TENANT_FILIAL_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.delete("/empresas/filiais/:id", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = tenantFilialIdParam.parse(request.params);
    try {
      const removed = await org.removeTenantFilial.execute(tenantId, id);
      if (!removed) return reply.status(404).send({ error: "Filial não encontrada" });
      return reply.status(204).send();
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TENANT_FILIAL_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.patch("/empresas/papeis-fiscais", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const parsed = tenantFiscalRolesBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      const tenant = await org.setTenantFiscalRoles.execute(tenantId, parsed.data);
      return org.tenantRepository.findByIdWithFiliais(tenant.id);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TENANT_FILIAL_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  // Compatibilidade com rotas legadas `/filiais`
  app.get("/filiais", async (request) => {
    const tenantId = tenantIdFromRequest(request);
    return org.listTenantFiliais.execute(tenantId);
  });
};

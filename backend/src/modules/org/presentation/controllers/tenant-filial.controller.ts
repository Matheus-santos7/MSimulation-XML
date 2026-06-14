import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { aplicarPapelEmitenteFilial, aplicarPapelEmitenteTenant } from "../../../../lib/org/emitente-fiscal-papeis.js";
import { runInTransaction } from "../../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { mapTenantFilial } from "../../../../lib/org/tenant-filial-mapper.js";
import {
  normalizeFilialCnpj,
  tenantFilialCreateBody,
  tenantFilialIdParam,
  tenantFilialUpdateBody,
} from "../schemas/tenant-filial.schemas.js";

export const tenantFilialController: FastifyPluginAsync = async (app) => {
  app.get("/filiais", async (request) => {
    const tenantId = tenantIdFromRequest(request);
    const rows = await getDbClient().tenantFilial.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapTenantFilial);
  });

  app.post("/filiais", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const parsed = tenantFilialCreateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const row = await runInTransaction(getDbClient(), async (tx) => {
      const created = await tx.tenantFilial.create({
        data: {
          tenantId,
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
          emitenteFiscalPrincipal: body.emitenteFiscalPrincipal ?? false,
          emitenteFiscalMatriz: body.emitenteFiscalMatriz ?? false,
        },
      });
      await aplicarPapelEmitenteFilial(tx, tenantId, created.id, {
        emitenteFiscalPrincipal: body.emitenteFiscalPrincipal,
        emitenteFiscalMatriz: body.emitenteFiscalMatriz,
      });
      return created;
    });
    return mapTenantFilial(row);
  });

  app.patch("/filiais/:id", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = tenantFilialIdParam.parse(request.params);
    const parsed = tenantFilialUpdateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    const existing = await getDbClient().tenantFilial.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: "Filial não encontrada" });
    }
    const body = parsed.data;
    const row = await runInTransaction(getDbClient(), async (tx) => {
      const updated = await tx.tenantFilial.update({
        where: { id },
        data: {
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
          ...(body.emitenteFiscalPrincipal !== undefined
            ? { emitenteFiscalPrincipal: body.emitenteFiscalPrincipal }
            : {}),
          ...(body.emitenteFiscalMatriz !== undefined
            ? { emitenteFiscalMatriz: body.emitenteFiscalMatriz }
            : {}),
        },
      });
      await aplicarPapelEmitenteFilial(tx, tenantId, id, {
        emitenteFiscalPrincipal: body.emitenteFiscalPrincipal,
        emitenteFiscalMatriz: body.emitenteFiscalMatriz,
      });
      return updated;
    });
    return mapTenantFilial(row);
  });
};

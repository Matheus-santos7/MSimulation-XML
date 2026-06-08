import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { tenantIdFromRequest } from "../lib/auth/request-context.js";
import {
  productBulkUpsertBody,
  productCreateBody,
  productIdParam,
  productUpdateBody,
} from "../schemas/product.js";
import { TaxRuleCatalogError } from "../services/tax-rule-catalog-service.js";
import { ProductConflictError, ProductService } from "../services/product-service.js";
import { RemessaError } from "../services/remessa-service.js";
import { UnidadeLogisticaError } from "../services/unidade-logistica-service.js";

export const productRoutes: FastifyPluginAsync = async (app) => {
  const service = new ProductService(app.prisma);

  app.get("/products", async (req) => {
    const tid = tenantIdFromRequest(req);
    return service.list(tid);
  });

  app.get("/products/:id", async (req, reply) => {
    const { id } = productIdParam.parse(req.params);
    const tid = tenantIdFromRequest(req);
    const product = await service.getById(id, tid);
    if (!product) return reply.status(404).send({ error: "Produto não encontrado" });
    return product;
  });

  app.post("/products", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const body = productCreateBody.parse(req.body);
      const product = await service.create(tid, body);
      return reply.status(201).send(product);
    } catch (e) {
      return handleProductError(e, reply);
    }
  });

  app.post("/products/bulk-upsert", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const { rows } = productBulkUpsertBody.parse(req.body);
      const result = await service.bulkUpsert(tid, rows);
      return reply.status(200).send(result);
    } catch (e) {
      return handleProductError(e, reply);
    }
  });

  app.patch("/products/:id", async (req, reply) => {
    try {
      const { id } = productIdParam.parse(req.params);
      const tid = tenantIdFromRequest(req);
      const body = productUpdateBody.parse(req.body);
      const product = await service.update(id, tid, body);
      if (!product) return reply.status(404).send({ error: "Produto não encontrado" });
      return product;
    } catch (e) {
      return handleProductError(e, reply);
    }
  });

  app.delete("/products/:id", async (req, reply) => {
    try {
      const { id } = productIdParam.parse(req.params);
      const tid = tenantIdFromRequest(req);
      const removed = await service.remove(id, tid);
      if (!removed) return reply.status(404).send({ error: "Produto não encontrado" });
      return reply.status(204).send();
    } catch (e) {
      return handleProductError(e, reply);
    }
  });
};

function handleProductError(e: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  if (e instanceof ZodError) {
    const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fieldErrors).flat()[0];
    return reply.status(400).send({
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    });
  }
  if (e instanceof ProductConflictError) {
    return reply.status(409).send({ error: e.message });
  }
  if (e instanceof RemessaError || e instanceof UnidadeLogisticaError) {
    return reply.status(400).send({ error: e.message });
  }
  if (e instanceof TaxRuleCatalogError) {
    return reply.status(400).send({ error: e.message });
  }
  throw e;
}

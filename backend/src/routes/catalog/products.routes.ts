import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import { handleRouteError } from "../../lib/http/domain-errors.js";
import {
  productBulkUpsertBody,
  productCreateBody,
  productIdParam,
  productUpdateBody,
} from "../../schemas/catalog/product.js";
import { TaxRuleCatalogError } from "../../services/fiscal/index.js";
import { ProductConflictError, ProductService } from "../../services/catalog/product-service.js";

const PRODUCT_ERROR_MAPPINGS = [
  { type: ProductConflictError, status: 409 },
  { type: TaxRuleCatalogError, status: 400 },
] as const;

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
      if (handleRouteError(reply, e, { mappings: [...PRODUCT_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });

  app.post("/products/bulk-upsert", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const { rows } = productBulkUpsertBody.parse(req.body);
      const result = await service.bulkUpsert(tid, rows);
      return reply.status(200).send(result);
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...PRODUCT_ERROR_MAPPINGS] })) return;
      throw e;
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
      if (handleRouteError(reply, e, { mappings: [...PRODUCT_ERROR_MAPPINGS] })) return;
      throw e;
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
      if (handleRouteError(reply, e, { mappings: [...PRODUCT_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });
};

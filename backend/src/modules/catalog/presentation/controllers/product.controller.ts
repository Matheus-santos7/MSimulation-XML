import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import {
  productBulkUpsertBody,
  productCreateBody,
  productIdParam,
  productUpdateBody,
} from "../schemas/product.schemas.js";
import { TaxRuleCatalogError } from "../../../tax/index.js";
import { ProductConflictError } from "../../domain/errors/product-conflict.error.js";
import { createCatalogModule } from "../../infrastructure/factory/catalog-module.factory.js";

const PRODUCT_ERROR_MAPPINGS = [
  { type: ProductConflictError, status: 409 },
  { type: TaxRuleCatalogError, status: 400 },
] as const;

export const productController: FastifyPluginAsync = async (app) => {
  const catalog = createCatalogModule(app.prisma);

  app.get("/products", async (request) => {
    const tenantId = tenantIdFromRequest(request);
    return catalog.listProducts.execute(tenantId);
  });

  app.get("/products/:id", async (request, reply) => {
    const { id } = productIdParam.parse(request.params);
    const tenantId = tenantIdFromRequest(request);
    const product = await catalog.getProductById.execute(id, tenantId);
    if (!product) return reply.status(404).send({ error: "Produto não encontrado" });
    return product;
  });

  app.post("/products", async (request, reply) => {
    try {
      const tenantId = tenantIdFromRequest(request);
      const body = productCreateBody.parse(request.body);
      const product = await catalog.createProduct.execute(tenantId, body);
      return reply.status(201).send(product);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...PRODUCT_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.post("/products/bulk-upsert", async (request, reply) => {
    try {
      const tenantId = tenantIdFromRequest(request);
      const { rows } = productBulkUpsertBody.parse(request.body);
      const result = await catalog.bulkUpsertProducts.execute({ tenantId, rows });
      return reply.status(200).send(result);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...PRODUCT_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.patch("/products/:id", async (request, reply) => {
    try {
      const { id } = productIdParam.parse(request.params);
      const tenantId = tenantIdFromRequest(request);
      const body = productUpdateBody.parse(request.body);
      const product = await catalog.updateProduct.execute(id, tenantId, body);
      if (!product) return reply.status(404).send({ error: "Produto não encontrado" });
      return product;
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...PRODUCT_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.delete("/products/:id", async (request, reply) => {
    try {
      const { id } = productIdParam.parse(request.params);
      const tenantId = tenantIdFromRequest(request);
      const wasDeleted = await catalog.deleteProduct.execute(id, tenantId);
      if (!wasDeleted) return reply.status(404).send({ error: "Produto não encontrado" });
      return reply.status(204).send();
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...PRODUCT_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });
};

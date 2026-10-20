import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, Res, UseFilters } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../../nest/http/api-exception.filter.js";
import { sendFile, XLSX_CONTENT_TYPE } from "../../../../nest/http/file-download.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { orUploadError } from "../../../../nest/http/upload-result.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { TaxRuleCatalogError } from "../../../tax/index.js";
import {
  buildProductSpreadsheetTemplateXlsx,
  buildProductSpreadsheetXlsx,
} from "../../application/services/product-spreadsheet.export.js";
import { CATALOG, type CatalogContext } from "../../catalog.tokens.js";
import { ProductConflictError } from "../../domain/errors/product-conflict.error.js";
import { ProductValidationError } from "../../domain/errors/product-validation.error.js";
import { resolveProductSpreadsheetUpload } from "../helpers/product-import.helper.js";
import { productBulkUpsertBody, productCreateBody, productIdParam, productUpdateBody } from "../schemas/product.schemas.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const PRODUCT_NOT_FOUND = "Produto não encontrado";

const PRODUCT_ERROR_MAPPINGS = [
  { type: ProductConflictError, status: 409 },
  { type: ProductValidationError, status: 400 },
  { type: TaxRuleCatalogError, status: 400 },
] as const;

type ProductIdParam = z.infer<typeof productIdParam>;

/**
 * Controller HTTP de produtos (Catalog).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/products` | ListProductsUseCase |
 * | GET | `/products/:id` | GetProductByIdUseCase |
 * | POST | `/products` | CreateProductUseCase (ADMIN) |
 * | GET | `/products/spreadsheet/template` | planilha modelo |
 * | GET | `/products/spreadsheet/export` | ListProductsUseCase → XLSX |
 * | POST | `/products/import-spreadsheet` | ImportProductsSpreadsheetUseCase (ADMIN) |
 * | POST | `/products/bulk-upsert` | BulkUpsertProductsUseCase (ADMIN) |
 * | PATCH | `/products/:id` | UpdateProductUseCase (ADMIN) |
 * | DELETE | `/products/:id` | DeleteProductUseCase (ADMIN) |
 */
@Controller("products")
@ProtectedApi()
@UseFilters(new RouteErrorFilter({ mappings: PRODUCT_ERROR_MAPPINGS }))
export class ProductController {
  constructor(@Inject(CATALOG) private readonly catalog: CatalogContext) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.catalog.listProducts.execute(tenantId);
  }

  @Get("spreadsheet/template")
  template(@Res() reply: FastifyReply) {
    return sendFile(reply, {
      content: buildProductSpreadsheetTemplateXlsx(),
      contentType: XLSX_CONTENT_TYPE,
      fileName: "produtos-modelo.xlsx",
    });
  }

  @Get("spreadsheet/export")
  async export(@TenantId() tenantId: string, @Res() reply: FastifyReply) {
    const products = await this.catalog.listProducts.execute(tenantId);

    return sendFile(reply, {
      content: buildProductSpreadsheetXlsx(products),
      contentType: XLSX_CONTENT_TYPE,
      fileName: "produtos-catalogo.xlsx",
    });
  }

  @Get(":id")
  async get(@Param(new ZodValidationPipe(productIdParam)) params: ProductIdParam, @TenantId() tenantId: string) {
    return orNotFound(await this.catalog.getProductById.execute(params.id, tenantId), PRODUCT_NOT_FOUND);
  }

  @Post()
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(productCreateBody)) body: z.infer<typeof productCreateBody>,
  ) {
    return this.catalog.createProduct.execute(tenantId, body);
  }

  @Post("import-spreadsheet")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  async importSpreadsheet(@TenantId() tenantId: string, @Req() request: FastifyRequest) {
    const upload = orUploadError(await resolveProductSpreadsheetUpload(request));

    return this.catalog.importProductsSpreadsheet.execute(tenantId, upload.buffer, upload.fileName);
  }

  @Post("bulk-upsert")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  bulkUpsert(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(productBulkUpsertBody)) body: z.infer<typeof productBulkUpsertBody>,
  ) {
    return this.catalog.bulkUpsertProducts.execute({ tenantId, rows: body.rows });
  }

  @Patch(":id")
  @AdminOnly()
  async update(
    @Param(new ZodValidationPipe(productIdParam)) params: ProductIdParam,
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(productUpdateBody)) body: z.infer<typeof productUpdateBody>,
  ) {
    return orNotFound(await this.catalog.updateProduct.execute(params.id, tenantId, body), PRODUCT_NOT_FOUND);
  }

  @Delete(":id")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  async remove(@Param(new ZodValidationPipe(productIdParam)) params: ProductIdParam, @TenantId() tenantId: string) {
    orNotFound(await this.catalog.deleteProduct.execute(params.id, tenantId), PRODUCT_NOT_FOUND);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseFilters,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../nest/http/api-exception.filter.js";
import { sendFile, XLSX_CONTENT_TYPE } from "../../../nest/http/file-download.js";
import { orUploadError } from "../../../nest/http/upload-result.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { TaxRuleCatalogError } from "../../tax/index.js";
import { ProductService } from "../product/product.service.js";
import {
  bulkUpsertProductsRequestSchema,
  type BulkUpsertProductsRequestDTO,
} from "./dtos/bulk-upsert-products.request.dto.js";
import { resolveProductSpreadsheetUpload } from "./product-import-upload.js";
import {
  buildProductSpreadsheetTemplateXlsx,
  buildProductSpreadsheetXlsx,
} from "./spreadsheet/product-spreadsheet.export.js";
import { BulkUpsertProductsUseCase } from "./use-cases/bulk-upsert-products.usecase.js";
import { ImportProductsSpreadsheetUseCase } from "./use-cases/import-products-spreadsheet.usecase.js";

const HTTP_OK = 200;

/**
 * Planilha de produtos: modelo, exportação, importação (CSV/XLSX) e upsert em massa por SKU.
 *
 * | Método | Rota | Destino |
 * |--------|------|---------|
 * | GET | `/products/spreadsheet/template` | planilha modelo |
 * | GET | `/products/spreadsheet/export` | produtos da empresa → XLSX |
 * | POST | `/products/import-spreadsheet` | ImportProductsSpreadsheetUseCase (ADMIN) |
 * | POST | `/products/bulk-upsert` | BulkUpsertProductsUseCase (ADMIN) |
 */
@Controller("products")
@ApiTags("products")
@ProtectedApi()
@UseFilters(new RouteErrorFilter({ mappings: [{ type: TaxRuleCatalogError, status: 400 }] }))
export class ProductImportController {
  constructor(
    @Inject(ProductService) private readonly productService: ProductService,
    @Inject(ImportProductsSpreadsheetUseCase)
    private readonly importProductsSpreadsheet: ImportProductsSpreadsheetUseCase,
    @Inject(BulkUpsertProductsUseCase)
    private readonly bulkUpsertProducts: BulkUpsertProductsUseCase,
  ) {}

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
    const products = await this.productService.list(tenantId);

    return sendFile(reply, {
      content: buildProductSpreadsheetXlsx(products),
      contentType: XLSX_CONTENT_TYPE,
      fileName: "produtos-catalogo.xlsx",
    });
  }

  @Post("import-spreadsheet")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  async importSpreadsheet(@TenantId() tenantId: string, @Req() request: FastifyRequest) {
    const upload = orUploadError(await resolveProductSpreadsheetUpload(request));

    return this.importProductsSpreadsheet.execute(tenantId, upload.buffer, upload.fileName);
  }

  @Post("bulk-upsert")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  bulkUpsert(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(bulkUpsertProductsRequestSchema))
    body: BulkUpsertProductsRequestDTO,
  ) {
    return this.bulkUpsertProducts.execute({ tenantId, rows: body.rows });
  }
}

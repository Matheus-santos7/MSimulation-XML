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
  UseFilters,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../nest/http/api-exception.filter.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { TaxRuleCatalogError } from "../../tax/index.js";
import {
  createProductRequestSchema,
  type CreateProductRequestDTO,
} from "./dtos/create-product.request.dto.js";
import { productParamsSchema, type ProductParamsDTO } from "./dtos/product.params.dto.js";
import {
  updateProductRequestSchema,
  type UpdateProductRequestDTO,
} from "./dtos/update-product.request.dto.js";
import { ProductService } from "./product.service.js";
import { CreateProductUseCase } from "./use-cases/create-product.usecase.js";
import { UpdateProductUseCase } from "./use-cases/update-product.usecase.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

/** Regra fiscal recusada ao vincular ao produto responde 400 (erro de domínio do tax). */
const taxRuleCatalogErrorFilter = new RouteErrorFilter({
  mappings: [{ type: TaxRuleCatalogError, status: 400 }],
});

/**
 * Produtos do catálogo. Importação e exportação por planilha ficam em `ProductImportController`.
 *
 * | Método | Rota | Destino |
 * |--------|------|---------|
 * | GET | `/products` | ProductService.list |
 * | GET | `/products/:id` | ProductService.get |
 * | POST | `/products` | CreateProductUseCase (ADMIN) |
 * | PATCH | `/products/:id` | UpdateProductUseCase (ADMIN) |
 * | DELETE | `/products/:id` | ProductService.delete (ADMIN) |
 */
@Controller("products")
@ApiTags("products")
@ProtectedApi()
@UseFilters(taxRuleCatalogErrorFilter)
export class ProductController {
  constructor(
    @Inject(ProductService) private readonly productService: ProductService,
    @Inject(CreateProductUseCase) private readonly createProduct: CreateProductUseCase,
    @Inject(UpdateProductUseCase) private readonly updateProduct: UpdateProductUseCase,
  ) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.productService.list(tenantId);
  }

  @Get(":id")
  get(
    @Param(new ZodValidationPipe(productParamsSchema)) params: ProductParamsDTO,
    @TenantId() tenantId: string,
  ) {
    return this.productService.get(params.id, tenantId);
  }

  @Post()
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createProductRequestSchema)) body: CreateProductRequestDTO,
  ) {
    return this.createProduct.execute(tenantId, body);
  }

  @Patch(":id")
  @AdminOnly()
  async update(
    @Param(new ZodValidationPipe(productParamsSchema)) params: ProductParamsDTO,
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateProductRequestSchema)) body: UpdateProductRequestDTO,
  ) {
    return this.productService.orNotFound(
      await this.updateProduct.execute(params.id, tenantId, body),
    );
  }

  @Delete(":id")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  remove(
    @Param(new ZodValidationPipe(productParamsSchema)) params: ProductParamsDTO,
    @TenantId() tenantId: string,
  ) {
    return this.productService.delete(params.id, tenantId);
  }
}

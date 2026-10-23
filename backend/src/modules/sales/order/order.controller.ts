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
import { ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { orNotFound } from "../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { salesErrorFilter } from "../errors/sales-error.filter.js";
import {
  orderCheckoutBody,
  orderIdParam,
  type OrderCheckoutBody,
  type OrderIdParam,
} from "./dtos/order.request.dto.js";
import { mapOrderToIntegrationPayload } from "./integration/order-integration.mapper.js";
import { OrderService } from "./order.service.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const ORDER_NOT_FOUND = "Pedido não encontrado";

/** Pedidos de venda em rascunho e o payload de integração (hub/ERP). */
@Controller("pedidos")
@ProtectedApi()
@UseFilters(salesErrorFilter)
export class OrderController {
  constructor(@Inject(OrderService) private readonly orders: OrderService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.orders.list(tenantId);
  }

  @Get(":id")
  async get(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
  ) {
    return orNotFound(await this.orders.get(tenantId, params.id), ORDER_NOT_FOUND);
  }

  @Get(":id/integracao")
  async integrationPayload(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
  ) {
    const order = orNotFound(await this.orders.get(tenantId, params.id), ORDER_NOT_FOUND);

    return mapOrderToIntegrationPayload(order);
  }

  /** Rascunho no marketplace informado; qualquer marketplace pode ter rascunho. */
  @Post()
  @HttpCode(HTTP_CREATED)
  createDraft(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(orderCheckoutBody)) body: OrderCheckoutBody,
  ) {
    return this.orders.createDraft(tenantId, body);
  }

  @Patch(":id")
  async updateDraft(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(orderCheckoutBody)) body: OrderCheckoutBody,
  ) {
    return orNotFound(await this.orders.updateDraft(params.id, tenantId, body), ORDER_NOT_FOUND);
  }

  @Delete(":id")
  @HttpCode(HTTP_NO_CONTENT)
  async remove(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
  ) {
    orNotFound(await this.orders.remove(tenantId, params.id), ORDER_NOT_FOUND);
  }
}

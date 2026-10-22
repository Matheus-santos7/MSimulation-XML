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
import type { z } from "zod";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../../nest/http/api-exception.filter.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { SaldoRemessaInsuficienteError } from "../../../remessas/index.js";
import { CheckoutError } from "../../domain/errors/checkout.error.js";
import { OrderLockedError } from "../../domain/errors/order-locked.error.js";
import { SalesChainError } from "../../domain/errors/sales-chain.error.js";
import { SALES, type SalesContext } from "../../sales.tokens.js";
import { mapOrderToIntegrationPayload } from "../mappers/order-integration.mapper.js";
import { orderCheckoutBody, orderIdParam } from "../schemas/order.schemas.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const ORDER_NOT_FOUND = "Pedido não encontrado";

/** Mapeamento de erros de domínio da venda para códigos HTTP na API. */
const ORDER_ERROR_MAPPINGS = [
  { type: OrderLockedError, status: 409 },
  { type: CheckoutError, status: 400 },
  { type: SalesChainError, status: 400 },
  {
    type: SaldoRemessaInsuficienteError,
    status: 422,
    toBody: (error: Error) => {
      const e = error as SaldoRemessaInsuficienteError;

      return { error: e.message, disponivel: e.disponivel, solicitado: e.solicitado };
    },
  },
] as const;

type OrderIdParam = z.infer<typeof orderIdParam>;
type OrderCheckoutBody = z.infer<typeof orderCheckoutBody>;

/**
 * Controller HTTP de pedidos de venda (Sales).
 *
 * Delega toda a lógica aos use cases do módulo; valida entrada com Zod e traduz
 * erros de domínio pelo `RouteErrorFilter`.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/pedidos` | ListOrdersUseCase |
 * | GET | `/pedidos/:id` | GetOrderByIdUseCase |
 * | GET | `/pedidos/:id/integracao` | GetOrderByIdUseCase → payload de integração |
 * | POST | `/pedidos` | CreateOrderDraftUseCase |
 * | PATCH | `/pedidos/:id` | UpdateOrderDraftUseCase |
 * | DELETE | `/pedidos/:id` | RemoveOrderUseCase |
 * | POST | `/pedidos/:id/faturar` | InvoiceOrderUseCase (ADMIN) |
 * | POST | `/pedidos/checkout` | ProcessCheckoutUseCase (ADMIN) |
 */
@Controller("pedidos")
@ProtectedApi()
@UseFilters(new RouteErrorFilter({ mappings: ORDER_ERROR_MAPPINGS }))
export class OrderController {
  constructor(@Inject(SALES) private readonly sales: SalesContext) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.sales.listOrders.execute(tenantId);
  }

  @Get(":id")
  async get(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
  ) {
    return orNotFound(await this.sales.getOrderById.execute(tenantId, params.id), ORDER_NOT_FOUND);
  }

  @Get(":id/integracao")
  async integrationPayload(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
  ) {
    const order = orNotFound(
      await this.sales.getOrderById.execute(tenantId, params.id),
      ORDER_NOT_FOUND,
    );

    return mapOrderToIntegrationPayload(order);
  }

  @Post()
  @HttpCode(HTTP_CREATED)
  createDraft(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(orderCheckoutBody)) body: OrderCheckoutBody,
  ) {
    return this.sales.createOrderDraft.execute(tenantId, body);
  }

  @Patch(":id")
  async updateDraft(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(orderCheckoutBody)) body: OrderCheckoutBody,
  ) {
    return orNotFound(
      await this.sales.updateOrderDraft.execute(params.id, tenantId, body),
      ORDER_NOT_FOUND,
    );
  }

  @Post(":id/faturar")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  async invoice(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
  ) {
    return orNotFound(await this.sales.invoiceOrder.execute(tenantId, params.id), ORDER_NOT_FOUND);
  }

  @Delete(":id")
  @HttpCode(HTTP_NO_CONTENT)
  async remove(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
  ) {
    orNotFound(await this.sales.removeOrder.execute(tenantId, params.id), ORDER_NOT_FOUND);
  }

  @Post("checkout")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  checkout(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(orderCheckoutBody)) body: OrderCheckoutBody,
  ) {
    return this.sales.processCheckout.execute(tenantId, body);
  }
}

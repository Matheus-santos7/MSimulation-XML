import { Body, Controller, HttpCode, Inject, Param, Post, UseFilters } from "@nestjs/common";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { orNotFound } from "../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { salesErrorFilter } from "../errors/sales-error.filter.js";
import {
  orderCheckoutBody,
  orderIdParam,
  type OrderCheckoutBody,
  type OrderIdParam,
} from "../order/dtos/order.request.dto.js";
import { OrderCheckoutUseCase } from "./use-cases/order-checkout.usecase.js";
import { OrderInvoiceUseCase } from "./use-cases/order-invoice.usecase.js";

const HTTP_CREATED = 201;
const ORDER_NOT_FOUND = "Pedido não encontrado";

/**
 * Faturamento: emite retorno simbólico, venda e CT-e no marketplace do pedido. Marketplace
 * ainda sem perfil fiscal responde 422 "Marketplace ainda não configurado para faturamento".
 */
@Controller("pedidos")
@ProtectedApi()
@UseFilters(salesErrorFilter)
export class InvoicingController {
  constructor(
    @Inject(OrderInvoiceUseCase) private readonly invoiceOrder: OrderInvoiceUseCase,
    @Inject(OrderCheckoutUseCase) private readonly checkoutOrder: OrderCheckoutUseCase,
  ) {}

  @Post(":id/faturar")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  async invoice(
    @Param(new ZodValidationPipe(orderIdParam)) params: OrderIdParam,
    @TenantId() tenantId: string,
  ) {
    return orNotFound(await this.invoiceOrder.execute(tenantId, params.id), ORDER_NOT_FOUND);
  }

  /** Checkout direto: fatura sem criar rascunho e devolve a NF-e de venda. */
  @Post("checkout")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  checkout(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(orderCheckoutBody)) body: OrderCheckoutBody,
  ) {
    return this.checkoutOrder.execute(tenantId, body);
  }
}

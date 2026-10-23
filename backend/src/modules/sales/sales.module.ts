import { Module } from "@nestjs/common";
import { InvoicingController } from "./invoicing/invoicing.controller.js";
import { SalesChainEmitter } from "./invoicing/sales-chain/sales-chain.emitter.js";
import { OrderCheckoutUseCase } from "./invoicing/use-cases/order-checkout.usecase.js";
import { OrderInvoiceUseCase } from "./invoicing/use-cases/order-invoice.usecase.js";
import { OrderController } from "./order/order.controller.js";
import { OrderRepository } from "./order/order.repository.js";
import { OrderService } from "./order/order.service.js";

/**
 * Vendas.
 *
 * | Pasta | Rotas |
 * |-------|-------|
 * | `order/` | GET/POST /pedidos, GET/PATCH/DELETE /pedidos/:id, GET /pedidos/:id/integracao |
 * | `invoicing/` | POST /pedidos/:id/faturar, POST /pedidos/checkout (ADMIN) |
 *
 * O pedido nasce com o marketplace que vai faturá-lo. O id do pedido segue o formato do perfil
 * do marketplace; o faturamento usa o perfil fiscal, a configuração efetiva do faturador e o
 * estoque FIFO daquele marketplace.
 */
@Module({
  controllers: [InvoicingController, OrderController],
  providers: [
    OrderRepository,
    OrderService,
    SalesChainEmitter,
    OrderInvoiceUseCase,
    OrderCheckoutUseCase,
  ],
})
export class SalesModule {}

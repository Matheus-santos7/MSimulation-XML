import { Inject, Injectable } from "@nestjs/common";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { OrderRepository } from "../../order/order.repository.js";
import { resolveMarketplaceOrderId } from "../../order/rules/marketplace-order-id.js";
import type { OrderCheckoutInput } from "../../order/types/order-checkout-input.types.js";
import { SalesChainEmitter } from "../sales-chain/sales-chain.emitter.js";
import type { OrderForEmit } from "../types/order-for-emit.types.js";
import {
  assertOrderFreightFilled,
  normalizeOrderFreight,
} from "../../order/rules/order-freight.validation.js";

/**
 * Checkout direto: emite a Sales Chain sem criar rascunho de pedido.
 *
 * Fluxo: carrega produtos/tenant → monta `OrderForEmit` → orquestra
 * retorno simbólico + venda + CT-e em transação única → devolve apenas a NF-e de venda.
 *
 * @param tenantId - Tenant emitente
 * @param input - Dados do checkout (marketplace, itens, comprador)
 * @returns DTO da NF-e de VENDA emitida
 * @throws {CheckoutError} Produto inválido
 * @throws {SalesChainError} Regra fiscal ou custo ausente
 * @throws {SaldoRemessaInsuficienteError} FIFO sem saldo (propagado do módulo remessas)
 * @throws {MarketplaceNotConfiguredError} Marketplace ainda sem perfil fiscal (422)
 */
@Injectable()
export class OrderCheckoutUseCase {
  constructor(
    @Inject(OrderRepository) private readonly orderRepository: OrderRepository,
    @Inject(SalesChainEmitter) private readonly salesChain: SalesChainEmitter,
  ) {}

  async execute(tenantId: string, input: OrderCheckoutInput) {
    const productIds = input.items.map((item) => item.productId);
    const { products, tenant } = await this.orderRepository.loadCheckoutContext(
      tenantId,
      productIds,
    );
    const productById = new Map(products.map((product) => [product.id, product]));
    const c = input.comprador;

    assertOrderFreightFilled(input);
    const { freteConsumidor, freteSeller } = normalizeOrderFreight(input);

    const orderForEmit: OrderForEmit = {
      tenantId,
      marketplace: input.marketplace,
      marketplaceOrderId: resolveMarketplaceOrderId(input.marketplace, input.pedidoMl),
      items: input.items.map((item) => {
        const product = productById.get(item.productId)!;
        const desconto = Number(item.desconto ?? 0);
        return {
          productId: product.id,
          quantidade: item.quantidade,
          product,
          ...(desconto > 0 ? { valorDesconto: desconto } : {}),
        };
      }),
      ...(freteConsumidor > 0 ? { valorFreteConsumidor: freteConsumidor } : {}),
      ...(freteSeller > 0 ? { valorFreteSeller: freteSeller } : {}),
      destCpf: c.cpf,
      destNome: c.nome,
      destLogradouro: c.logradouro,
      destNumero: c.numero,
      destComplemento: c.complemento ?? null,
      destBairro: c.bairro,
      destCodigoMunicipio: c.codigoMunicipio,
      destMunicipio: c.municipio,
      destUf: c.uf,
      destCep: c.cep,
      destCodigoPais: c.codigoPais,
      destNomePais: c.nomePais,
      destTelefone: c.telefone?.replace(/\D/g, "") ?? null,
      destIndIeDest: c.indIEDest,
      destIe: c.ie?.replace(/\D/g, "") || null,
      tenant,
    };

    const result = await this.salesChain.emit(getDbClient(), orderForEmit);
    return result.venda;
  }
}

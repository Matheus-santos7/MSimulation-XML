import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";

/**
 * Checkout direto: emite a Sales Chain sem criar rascunho de pedido.
 *
 * Fluxo: carrega produto/tenant → monta `OrderForEmit` → orquestra
 * retorno simbólico + venda + CT-e em transação única → devolve apenas a NF-e de venda.
 *
 * @param tenantId - Tenant emitente
 * @param input - Dados do checkout (produto, quantidade, comprador)
 * @returns DTO da NF-e de VENDA emitida
 * @throws {CheckoutError} Produto inválido
 * @throws {SalesChainError} Regra fiscal ou custo ausente
 * @throws {SaldoRemessaInsuficienteError} FIFO sem saldo (propagado do módulo remessas)
 */
export class ProcessCheckoutUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly salesChain: SalesChainPort,
  ) {}

  async execute(tenantId: string, input: OrderCheckoutInput) {
    const { product, tenant } = await this.orderRepository.loadCheckoutContext(
      tenantId,
      input.productId,
    );
    const c = input.comprador;

    const orderForEmit: OrderForEmit = {
      tenantId,
      productId: product.id,
      quantidade: input.quantidade,
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
      product,
      tenant,
    };

    const result = await this.salesChain.emit(getDbClient(), orderForEmit);
    return result.venda;
  }
}

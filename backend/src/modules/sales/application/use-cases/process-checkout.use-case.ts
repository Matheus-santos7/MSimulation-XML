import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";

export class ProcessCheckoutUseCase {
  constructor(
    private readonly prisma: PrismaClient,
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
      product,
      tenant,
    };

    const result = await this.salesChain.emit(this.prisma, orderForEmit);
    return result.venda;
  }
}

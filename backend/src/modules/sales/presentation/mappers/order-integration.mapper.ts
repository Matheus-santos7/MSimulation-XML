import type { Order } from "../../domain/entities/order.entity.js";
import type {
  ExternalOrderIntegrationPayload,
  ExternalOrderProduct,
} from "../../domain/entities/order-integration-payload.entity.js";

type MapOrderIntegrationOptions = {
  idLoja?: string;
  idHub?: number;
  idCanal?: number;
  nomeTransportador?: string;
  descricaoPagamento?: string;
  fulfillment?: number;
  informacoesExternas?: Record<string, string>;
};

function formatIsoDate(date: string | Date): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toISOString();
}

function mapAddress(order: Order) {
  const buyer = order.comprador;
  return {
    cep: buyer.cep,
    endereco: buyer.logradouro,
    numero: buyer.numero,
    complemento: buyer.complemento ?? "",
    referencia: "",
    bairro: buyer.bairro,
    cidade: buyer.municipio,
    estado: buyer.uf,
  };
}

function mapProducts(order: Order): ExternalOrderProduct[] {
  const channelId = order.pedidoMl ?? order.id;
  return order.items.map((item) => ({
    idPedidoCanal: channelId,
    sku: item.product.sku,
    quantidade: item.quantidade,
    precoUnitario: item.product.preco,
    precoCusto: 0,
    valorDesconto: item.desconto,
    valorFrete: item.frete,
    valorComissao: 0,
    valorOutros: 0,
    marca: "",
    grade: "",
    tipoAnuncio: "",
    ncm: "",
    origem: "",
    volume: "",
  }));
}

/**
 * Maps a domain {@link Order} into the external hub/marketplace integration payload.
 */
export function mapOrderToIntegrationPayload(
  order: Order,
  options: MapOrderIntegrationOptions = {},
): ExternalOrderIntegrationPayload {
  const channelId = order.pedidoMl ?? order.id;
  const totalDesconto = order.items.reduce((acc, item) => acc + item.desconto, 0);
  const totalFrete = order.items.reduce((acc, item) => acc + item.frete, 0);
  const address = mapAddress(order);
  const doc = order.comprador.cpf;

  return {
    idLoja: options.idLoja ?? "0",
    codigoPedidoWeb: channelId,
    idPedidoHub: channelId,
    idPedidoCanal: channelId,
    dataPedido: formatIsoDate(order.createdAt),
    dataExpiracao: "",
    dataEntrega: "",
    nomeTransportador: options.nomeTransportador ?? "me2 - Fulfillment",
    observacoesEntrega: order.comprador.complemento ?? "",
    idFuncionario: 0,
    idHub: options.idHub ?? 4,
    idCanal: options.idCanal ?? 2,
    status: order.status === "FATURADO" ? 1 : 0,
    produtos: mapProducts(order),
    cliente: {
      cnpjCpf: doc,
      nome: order.comprador.nome,
      email: `${doc}@mercadolivre.com`,
      ddd: "",
      telefone: order.comprador.telefone ?? "",
      celular: order.comprador.telefone ?? "",
      nomeFantasia: order.comprador.nome,
      ie: order.comprador.ie ?? "",
      rg: "",
      cobranca: address,
    },
    entrega: address,
    pagamento: {
      valorDesconto: totalDesconto,
      valorFrete: totalFrete,
      valorTotal: order.valorTotal,
      valorOutros: 0,
      formaPagamento: [
        {
          tipoPagamento: 2,
          bandeira: 127,
          descricaoPagamento: options.descricaoPagamento ?? "PIX",
          pedidoDividido: 1,
          parcelas: 1,
          valorDesconto: 0,
          valorFrete: totalFrete,
          valorTotal: order.valorTotal,
          autorizacao: "",
          nsu: "",
          idPagamentoMarketplace: channelId,
          valorRecebimento: order.valorTotal,
        },
      ],
      pedidoDividido: 1,
      valorRecebimento: order.valorTotal,
    },
    descricaoPagamento: options.descricaoPagamento ?? "pix",
    fulfillment: options.fulfillment ?? 1,
    informacoesExternas: {
      anymarket_order_status: order.status === "FATURADO" ? "CONCLUDED" : "PENDING",
      anymarket_ml_pack_id: channelId,
      ...options.informacoesExternas,
    },
    preventUpdate: order.status === "FATURADO",
  };
}

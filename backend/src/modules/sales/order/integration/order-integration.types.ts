/**
 * External order integration payload (hub / marketplace format).
 *
 * Mirrors the structure consumed by third-party ERP and hub APIs
 * (e.g. AnyMarket / Mercado Livre channel orders).
 */
export type ExternalOrderPaymentMethod = {
  tipoPagamento: number;
  bandeira: number;
  descricaoPagamento: string;
  pedidoDividido: number;
  parcelas: number;
  valorDesconto: number;
  valorFrete: number;
  valorTotal: number;
  autorizacao: string;
  nsu: string;
  idPagamentoMarketplace: string;
  valorRecebimento: number;
};

export type ExternalOrderProduct = {
  idPedidoCanal: string;
  sku: string;
  quantidade: number;
  precoUnitario: number;
  precoCusto: number;
  valorDesconto: number;
  valorFrete: number;
  valorComissao: number;
  valorOutros: number;
  marca: string;
  grade: string;
  tipoAnuncio: string;
  ncm: string;
  origem: string;
  volume: string;
};

export type ExternalOrderAddress = {
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  referencia: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export type ExternalOrderCustomer = {
  cnpjCpf: string;
  nome: string;
  email: string;
  ddd: string;
  telefone: string;
  celular: string;
  nomeFantasia: string;
  ie: string;
  rg: string;
  cobranca: ExternalOrderAddress;
};

export type ExternalOrderPayment = {
  valorDesconto: number;
  valorFrete: number;
  valorTotal: number;
  valorOutros: number;
  formaPagamento: ExternalOrderPaymentMethod[];
  pedidoDividido: number;
  valorRecebimento: number;
};

export type ExternalOrderIntegrationPayload = {
  idLoja: string;
  codigoPedidoWeb: string;
  idPedidoHub: string;
  idPedidoCanal: string;
  dataPedido: string;
  dataExpiracao: string;
  dataEntrega: string;
  nomeTransportador: string;
  observacoesEntrega: string;
  idFuncionario: number;
  idHub: number;
  idCanal: number;
  status: number;
  produtos: ExternalOrderProduct[];
  cliente: ExternalOrderCustomer;
  entrega: ExternalOrderAddress;
  pagamento: ExternalOrderPayment;
  descricaoPagamento: string;
  fulfillment: number;
  informacoesExternas: Record<string, string>;
  preventUpdate: boolean;
};

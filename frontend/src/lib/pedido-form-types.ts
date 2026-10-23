import { DEFAULT_MARKETPLACE, type MarketplaceCode } from "./marketplaces";

export type PedidoItemFormValues = {
  productId: string;
  quantidade: string;
  desconto: string;
  /** Id do pedido no marketplace por produto (`xPed`). */
  xPed: string;
};

export type PedidoFormValues = {
  /** Marketplace que vai faturar o pedido. */
  marketplace: MarketplaceCode;
  items: PedidoItemFormValues[];
  /** Id do pedido no marketplace (pack id no ML, `pedidoMl`). */
  pedidoMl: string;
  freteConsumidor: string;
  freteSeller: string;
  cpf: string;
  nome: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  indIEDest: string;
  ie: string;
};

export const PEDIDO_ITEM_EMPTY: PedidoItemFormValues = {
  productId: "",
  quantidade: "1",
  desconto: "0",
  xPed: "",
};

export const PEDIDO_FORM_EMPTY: PedidoFormValues = {
  marketplace: DEFAULT_MARKETPLACE,
  items: [{ ...PEDIDO_ITEM_EMPTY }],
  pedidoMl: "",
  freteConsumidor: "0",
  freteSeller: "0",
  cpf: "",
  nome: "",
  logradouro: "",
  numero: "SN",
  complemento: "",
  bairro: "",
  codigoMunicipio: "",
  municipio: "",
  uf: "SP",
  cep: "",
  telefone: "",
  indIEDest: "9",
  ie: "",
};

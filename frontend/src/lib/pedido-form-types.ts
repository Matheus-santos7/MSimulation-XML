export type PedidoItemFormValues = {
  productId: string;
  quantidade: string;
  desconto: string;
  frete: string;
};

export type PedidoFormValues = {
  items: PedidoItemFormValues[];
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
  frete: "0",
};

export const PEDIDO_FORM_EMPTY: PedidoFormValues = {
  items: [{ ...PEDIDO_ITEM_EMPTY }],
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

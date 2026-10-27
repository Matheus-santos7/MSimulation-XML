/**
 * Comprador final da venda (destinatário da NF-e de VENDA).
 *
 * `indIEDest`: 9 = não contribuinte (consumidor final); outros valores indicam contribuinte.
 * Campos espelham colunas `dest*` do modelo `pedido` / NF-e.
 */
export type Buyer = {
  cpf: string;
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string;
  codigoPais: number;
  nomePais: string;
  indIEDest: number;
  /** Inscrição estadual do destinatário — obrigatória quando `indIEDest === 1`. */
  ie?: string;
};

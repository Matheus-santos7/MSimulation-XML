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
};

export type EnvironmentKind = "HOMOLOGACAO" | "PRODUCAO";

export type Tenant = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  iest?: string;
  crt: number;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoPais: number;
  nomePais: string;
  telefone?: string;
  ambiente: EnvironmentKind;
};

/** Ambiente fiscal do emitente (homologação ou produção SEFAZ). */
export type EnvironmentKind = "HOMOLOGACAO" | "PRODUCAO";

/**
 * Empresa emitente (tenant) persistida em `tenant`.
 *
 * Representa o seller no simulador fiscal ML Full: dados cadastrais, endereço,
 * IE/CRT e ambiente de emissão. É a **raiz de isolamento** de dados — produtos,
 * pedidos, NF-e e utilizadores referenciam `tenantId`.
 *
 * CNPJ é único globalmente; criação inicial ocorre via onboarding (`auth` module),
 * não via `POST /tenants` da API protegida.
 */
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

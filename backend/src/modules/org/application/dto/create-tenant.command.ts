import type { EnvironmentKind } from "../../domain/entities/tenant.entity.js";

export type CreateTenantCommand = {
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

import type { EmpresaFormValues } from "@/lib/empresa-form";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export type EmpresaOnboardingStep = 1 | 2 | 3;

/** Campos da etapa 1 — identificação do emitente. */
export const EMPRESA_ONBOARDING_IDENTIFICACAO_FIELDS = [
  "cnpj",
  "razaoSocial",
  "nomeFantasia",
  "ie",
  "crt",
] as const satisfies readonly (keyof EmpresaFormValues)[];

/** Campos da etapa 2 — endereço do emitente. */
export const EMPRESA_ONBOARDING_ENDERECO_FIELDS = [
  "cep",
  "logradouro",
  "numero",
  "bairro",
  "municipio",
  "codigoMunicipio",
  "uf",
] as const satisfies readonly (keyof EmpresaFormValues)[];

/** Campos preenchidos antes da confirmação (identificação + endereço). */
export const EMPRESA_ONBOARDING_DATA_FIELDS = [
  ...EMPRESA_ONBOARDING_IDENTIFICACAO_FIELDS,
  ...EMPRESA_ONBOARDING_ENDERECO_FIELDS,
] as const satisfies readonly (keyof EmpresaFormValues)[];

/**
 * Valida os dados de identificação da empresa (etapa 1).
 */
export function validateEmpresaIdentificacao(values: EmpresaFormValues): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (digitsOnly(values.cnpj).length !== 14) {
    errors.cnpj = ["CNPJ deve ter 14 dígitos"];
  }
  if (!values.razaoSocial.trim()) {
    errors.razaoSocial = ["Razão social obrigatória"];
  }
  if (!values.nomeFantasia.trim()) {
    errors.nomeFantasia = ["Nome fantasia obrigatório"];
  }
  if (!values.ie.trim()) {
    errors.ie = ["IE obrigatória"];
  }
  if (!values.crt.trim()) {
    errors.crt = ["Regime tributário obrigatório"];
  }

  return errors;
}

/**
 * Valida o endereço do emitente (etapa 2).
 */
export function validateEmpresaEndereco(values: EmpresaFormValues): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (digitsOnly(values.cep).length !== 8) {
    errors.cep = ["CEP deve ter 8 dígitos"];
  }
  if (!values.logradouro.trim()) {
    errors.logradouro = ["Logradouro obrigatório"];
  }
  if (!values.numero.trim()) {
    errors.numero = ["Número obrigatório"];
  }
  if (!values.bairro.trim()) {
    errors.bairro = ["Bairro obrigatório"];
  }
  if (!values.municipio.trim()) {
    errors.municipio = ["Município obrigatório"];
  }
  if (digitsOnly(values.codigoMunicipio).length !== 7) {
    errors.codigoMunicipio = ["Código IBGE deve ter 7 dígitos"];
  }
  if (values.uf.trim().length !== 2) {
    errors.uf = ["UF deve ter 2 caracteres"];
  }

  return errors;
}

/**
 * Define em qual etapa do onboarding o usuário deve permanecer após erro de validação do servidor.
 */
export function resolveEmpresaOnboardingStep(fieldErrors?: Record<string, string[]>): EmpresaOnboardingStep {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) return 1;

  const identificacaoKeys = new Set<string>(EMPRESA_ONBOARDING_IDENTIFICACAO_FIELDS);
  const enderecoKeys = new Set<string>(EMPRESA_ONBOARDING_ENDERECO_FIELDS);

  if (Object.keys(fieldErrors).some((key) => identificacaoKeys.has(key))) return 1;
  if (Object.keys(fieldErrors).some((key) => enderecoKeys.has(key))) return 2;

  return 3;
}

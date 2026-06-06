import { lookupCep } from "@/lib/lookup-actions";
import type { TenantInput } from "@/lib/fiscal-types";

export async function enrichEmpresaFromCep(input: TenantInput): Promise<TenantInput> {
  if (input.codigoMunicipio.length === 7 || input.cep.length !== 8) return input;

  try {
    const viaCep = await lookupCep(input.cep);
    return {
      ...input,
      codigoMunicipio: viaCep.codigoMunicipio ?? input.codigoMunicipio,
      logradouro: input.logradouro || viaCep.logradouro,
      bairro: input.bairro || viaCep.bairro,
      municipio: input.municipio || viaCep.municipio,
      uf: input.uf || viaCep.uf,
    };
  } catch {
    return input;
  }
}

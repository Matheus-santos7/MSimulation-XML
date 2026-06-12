import { lookupCep } from "@/lib/fiscal-api";
import type { TenantInput } from "@/lib/fiscal-types";

/**
 * Enriquece endereço da empresa consultando `GET /api/lookup/cep/:cep` no backend
 * (rate-limit e fallback BrasilAPI → ViaCEP ficam no módulo lookup do servidor).
 */
export async function enrichEmpresaFromCep(input: TenantInput): Promise<TenantInput> {
  const cepDigits = input.cep.replace(/\D/g, "");
  if (input.codigoMunicipio.length === 7 || cepDigits.length !== 8) {
    return input;
  }

  try {
    const cepLookup = await lookupCep(cepDigits);
    return {
      ...input,
      cep: cepLookup.cep || cepDigits,
      codigoMunicipio: cepLookup.codigoMunicipio ?? input.codigoMunicipio,
      logradouro: input.logradouro || cepLookup.logradouro,
      bairro: input.bairro || cepLookup.bairro,
      municipio: input.municipio || cepLookup.municipio,
      uf: input.uf || cepLookup.uf,
    };
  } catch {
    return input;
  }
}

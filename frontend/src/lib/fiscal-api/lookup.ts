import type {
  CepLookupDto,
  CnpjLookupDto,
} from "../fiscal-types";
import {
  buildApiUrl,
  getJson,
} from "./client";

/** Consulta CEP via backend (`GET /api/lookup/cep/:cep`) — sem chamada direta a ViaCEP/BrasilAPI. */
export async function lookupCep(cep: string): Promise<CepLookupDto> {
  const digits = cep.replace(/\D/g, "");
  return getJson<CepLookupDto>(buildApiUrl(`/api/lookup/cep/${digits}`));
}

/** Consulta CNPJ via backend (`GET /api/lookup/cnpj/:cnpj`). */
export async function lookupCnpj(cnpj: string): Promise<CnpjLookupDto> {
  const digits = cnpj.replace(/\D/g, "");
  return getJson<CnpjLookupDto>(buildApiUrl(`/api/lookup/cnpj/${digits}`));
}

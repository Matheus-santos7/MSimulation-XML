"use server";

import { lookupCep as lookupCepApi, lookupCnpj as lookupCnpjApi } from "@/lib/fiscal-api";
import type { CepLookupDto, CnpjLookupDto } from "@/lib/fiscal-types";

/** Server action: consulta CEP via `GET /api/lookup/cep/:cep`. */
export async function lookupCep(cep: string): Promise<CepLookupDto> {
  return lookupCepApi(cep);
}

/** Server action: consulta CNPJ via `GET /api/lookup/cnpj/:cnpj`. */
export async function lookupCnpj(cnpj: string): Promise<CnpjLookupDto> {
  return lookupCnpjApi(cnpj);
}

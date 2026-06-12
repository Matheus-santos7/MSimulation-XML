import type { CepLookupResult } from "../entities/cep-lookup-result.entity.js";

export interface CepLookupPort {
  lookup(rawValue: string): Promise<CepLookupResult>;
}

import type { CnpjLookupResult } from "../entities/cnpj-lookup-result.entity.js";

export interface CnpjLookupPort {
  lookup(rawValue: string): Promise<CnpjLookupResult>;
}

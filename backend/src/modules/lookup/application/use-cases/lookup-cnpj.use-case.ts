import type { CnpjLookupPort } from "../../domain/ports/cnpj-lookup.port.js";

export class LookupCnpjUseCase {
  constructor(private readonly cnpjLookup: CnpjLookupPort) {}

  execute(rawValue: string) {
    return this.cnpjLookup.lookup(rawValue);
  }
}

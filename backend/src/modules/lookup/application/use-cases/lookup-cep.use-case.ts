import type { CepLookupPort } from "../../domain/ports/cep-lookup.port.js";

export class LookupCepUseCase {
  constructor(private readonly cepLookup: CepLookupPort) {}

  execute(rawValue: string) {
    return this.cepLookup.lookup(rawValue);
  }
}

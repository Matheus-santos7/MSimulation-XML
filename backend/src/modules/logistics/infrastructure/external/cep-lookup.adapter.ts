import { lookupCep } from "../../../../services/lookup/lookup-service.js";
import type { CepLookupPort } from "../../domain/ports/cep-lookup.port.js";

export class CepLookupAdapter implements CepLookupPort {
  async lookup(cep: string) {
    const data = await lookupCep(cep);
    return {
      bairro: data.bairro ?? "",
      codigoMunicipio: data.codigoMunicipio ?? "",
    };
  }
}

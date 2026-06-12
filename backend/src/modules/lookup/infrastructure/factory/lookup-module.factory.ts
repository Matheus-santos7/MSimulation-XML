import { LookupCepUseCase } from "../../application/use-cases/lookup-cep.use-case.js";
import { LookupCnpjUseCase } from "../../application/use-cases/lookup-cnpj.use-case.js";
import { HttpCepLookupGateway } from "../external/http-cep-lookup.gateway.js";
import { HttpCnpjLookupGateway } from "../external/http-cnpj-lookup.gateway.js";

/** Composition root for the Lookup bounded context. */
export function createLookupModule() {
  const cepLookupGateway = new HttpCepLookupGateway();
  const cnpjLookupGateway = new HttpCnpjLookupGateway(cepLookupGateway);

  return {
    lookupCep: new LookupCepUseCase(cepLookupGateway),
    lookupCnpj: new LookupCnpjUseCase(cnpjLookupGateway),
    cepLookupGateway,
    cnpjLookupGateway,
  };
}

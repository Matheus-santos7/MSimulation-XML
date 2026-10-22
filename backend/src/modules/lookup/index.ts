/** API pública do módulo lookup para outros módulos. */
import { CepLookupProvider } from "./providers/cep-lookup.provider.js";

export { CepLookupResponseDTO } from "./dtos/cep-lookup.response.dto.js";
export { CnpjLookupResponseDTO } from "./dtos/cnpj-lookup.response.dto.js";
export { LookupError } from "./errors/lookup.errors.js";
export { LookupModule } from "./lookup.module.js";
export { LookupService } from "./lookup.service.js";
export { CepLookupProvider } from "./providers/cep-lookup.provider.js";

/**
 * @deprecated Consulta de CEP fora do container Nest, usada pelo módulo logistics até ele injetar
 * `CepLookupProvider`. Sai na conversão do logistics.
 */
export async function lookupCep(rawValue: string) {
  return new CepLookupProvider().lookup(rawValue);
}

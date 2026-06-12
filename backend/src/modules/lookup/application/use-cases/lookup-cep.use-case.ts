import type { CepLookupPort } from "../../domain/ports/cep-lookup.port.js";

/**
 * Consulta endereço por CEP em APIs públicas brasileiras.
 *
 * Usado no onboarding e cadastros para preencher logradouro, bairro, município,
 * UF e código IBGE sem digitação manual.
 *
 * @param rawValue - CEP com ou sem máscara (8 dígitos após normalização)
 * @returns Dados normalizados {@link CepLookupResult}
 * @throws {LookupValidationError} CEP com tamanho inválido
 * @throws {LookupNotFoundError} CEP inexistente na base consultada
 * @throws {Error} APIs externas indisponíveis (propagado pelo gateway)
 */
export class LookupCepUseCase {
  constructor(private readonly cepLookup: CepLookupPort) {}

  execute(rawValue: string) {
    return this.cepLookup.lookup(rawValue);
  }
}

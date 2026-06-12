import type { CnpjLookupPort } from "../../domain/ports/cnpj-lookup.port.js";

/**
 * Consulta dados cadastrais de empresa por CNPJ em APIs públicas.
 *
 * Retorna razão social, endereço, telefone e CRT inferido (Simples/MEI vs regime normal)
 * para acelerar o cadastro do tenant no onboarding.
 *
 * @param rawValue - CNPJ com ou sem máscara (14 dígitos após normalização)
 * @returns Dados normalizados {@link CnpjLookupResult}
 * @throws {LookupValidationError} CNPJ inválido, fictício ou formato incorreto
 * @throws {LookupNotFoundError} CNPJ não encontrado em nenhuma fonte
 * @throws {Error} Todas as fontes indisponíveis (propagado pelo gateway)
 */
export class LookupCnpjUseCase {
  constructor(private readonly cnpjLookup: CnpjLookupPort) {}

  execute(rawValue: string) {
    return this.cnpjLookup.lookup(rawValue);
  }
}

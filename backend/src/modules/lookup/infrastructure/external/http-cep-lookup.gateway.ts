import type { CepLookupResult } from "../../domain/entities/cep-lookup-result.entity.js";
import { LookupNotFoundError } from "../../domain/errors/lookup-not-found.error.js";
import { LookupValidationError } from "../../domain/errors/lookup-validation.error.js";
import type { CepLookupPort } from "../../domain/ports/cep-lookup.port.js";

const BRASIL_API = "https://brasilapi.com.br/api";

/** Cabeçalhos padrão para APIs públicas (identificação do cliente HTTP). */
const FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent": "msimulation-xml/1.0 (fiscal-simulator)",
};

type BrasilApiCepResponse = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  city_ibge?: string;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean;
};

/**
 * Gateway HTTP de consulta de CEP.
 *
 * Estratégia em duas camadas:
 * 1. **BrasilAPI** (`/cep/v2/{cep}`) — fonte principal
 * 2. **ViaCEP** — fallback opcional só para código IBGE quando a BrasilAPI não retorna `city_ibge`
 *
 * @implements {CepLookupPort}
 */
export class HttpCepLookupGateway implements CepLookupPort {
  /**
   * @param rawValue - CEP bruto da rota ou formulário
   * @returns Endereço normalizado com `codigoMunicipio` quando disponível
   * @throws {LookupValidationError} Menos ou mais de 8 dígitos
   * @throws {LookupNotFoundError} HTTP 404 da BrasilAPI
   * @throws {Error} Resposta não-OK da BrasilAPI (exceto 404)
   */
  async lookup(rawValue: string): Promise<CepLookupResult> {
    const postalCode = rawValue.replace(/\D/g, "");
    if (postalCode.length !== 8) {
      throw new LookupValidationError("CEP deve ter 8 dígitos");
    }

    const response = await fetch(`${BRASIL_API}/cep/v2/${postalCode}`, { headers: FETCH_HEADERS });

    if (response.status === 404) throw new LookupNotFoundError("CEP não encontrado");
    if (!response.ok) throw new Error(`Consulta CEP indisponível (${response.status})`);

    const data = (await response.json()) as BrasilApiCepResponse;

    let municipalityCode = data.city_ibge;
    if (!municipalityCode) {
      municipalityCode = await this.resolveIbgeViaCep(postalCode);
    }

    return {
      cep: postalCode,
      logradouro: data.street ?? "",
      bairro: data.neighborhood ?? "",
      municipio: data.city ?? "",
      codigoMunicipio: municipalityCode,
      uf: (data.state ?? "").toUpperCase(),
    };
  }

  /**
   * Enriquecimento silencioso do código IBGE via ViaCEP.
   * Falhas não interrompem a consulta principal.
   */
  private async resolveIbgeViaCep(postalCode: string): Promise<string | undefined> {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`, {
        headers: FETCH_HEADERS,
      });
      if (!response.ok) return undefined;
      const data = (await response.json()) as ViaCepResponse;
      if (data.erro || !data.ibge) return undefined;
      return data.ibge.length === 7 ? data.ibge : undefined;
    } catch {
      return undefined;
    }
  }
}

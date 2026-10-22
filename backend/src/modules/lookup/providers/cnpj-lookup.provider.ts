import { Inject, Injectable } from "@nestjs/common";
import type { CnpjLookupResponseDTO } from "../dtos/cnpj-lookup.response.dto.js";
import { LookupError } from "../errors/lookup.errors.js";
import { CepLookupProvider } from "./cep-lookup.provider.js";

const BRASIL_API = "https://brasilapi.com.br/api";
const OPEN_CNPJ_API = "https://api.opencnpj.org";

const FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent": "msimulation-xml/1.0 (fiscal-simulator)",
};

type BrasilApiCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codigo_municipio_ibge?: number;
  ddd_telefone_1?: string;
  opcao_pelo_simples?: boolean;
  opcao_pelo_mei?: boolean;
  message?: string;
};

type OpenCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codigo_municipio?: number;
  telefones?: { ddd: string; numero: string }[];
  opcao_simples?: boolean;
  opcao_mei?: boolean;
};

/**
 * Gateway HTTP de consulta de CNPJ com fallback entre provedores.
 *
 * Ordem de resolução:
 * 1. **BrasilAPI** (`/cnpj/v1/{cnpj}`) — preferencial
 * 2. Em **403/429** ou erro transitório, tenta **OpenCNPJ** sem falhar imediatamente
 * 3. Na resposta OpenCNPJ, enriquece IBGE/município via {@link CepLookupProvider} quando há CEP
 *
 * CRT inferido: `1` (Simples/MEI) ou `3` (regime normal).
 *
 *
 */
@Injectable()
export class CnpjLookupProvider {
  constructor(@Inject(CepLookupProvider) private readonly cepLookup: CepLookupProvider) {}

  /**
   * @param rawValue - CNPJ bruto da rota ou formulário
   * @returns Cadastro normalizado para pré-preenchimento de tenant
   * @throws {LookupError.Invalid} Formato inválido ou CNPJ fictício (BrasilAPI 400)
   * @throws {LookupError.NotFound} Não encontrado em BrasilAPI nem OpenCNPJ
   * @throws {Error} OpenCNPJ indisponível após fallback
   */
  async lookup(rawValue: string): Promise<CnpjLookupResponseDTO> {
    const taxId = rawValue.replace(/\D/g, "");
    if (taxId.length !== 14) {
      throw new LookupError.Invalid("CNPJ deve ter 14 dígitos");
    }

    try {
      const fromBrasilApi = await this.fetchFromBrasilApi(taxId);
      if (fromBrasilApi) return fromBrasilApi;
    } catch (error) {
      if (error instanceof LookupError.NotFound || error instanceof LookupError.Invalid) {
        throw error;
      }
    }

    return this.fetchFromOpenCnpj(taxId);
  }

  /**
   * Consulta BrasilAPI. Retorna `null` em rate limit (429) ou bloqueio (403)
   * para permitir fallback sem expor erro ao cliente.
   */
  private async fetchFromBrasilApi(taxId: string): Promise<CnpjLookupResponseDTO | null> {
    const response = await fetch(`${BRASIL_API}/cnpj/v1/${taxId}`, { headers: FETCH_HEADERS });

    if (response.status === 404) {
      throw new LookupError.NotFound("CNPJ não encontrado na base pública");
    }

    if (response.status === 400) {
      throw new LookupError.Invalid(
        "CNPJ inválido ou fictício. Use um CNPJ real da Receita ou preencha os campos manualmente.",
      );
    }

    if (response.status === 403 || response.status === 429) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return this.mapBrasilApiResponse((await response.json()) as BrasilApiCnpjResponse, taxId);
  }

  /** Segunda fonte quando BrasilAPI está limitada ou indisponível. */
  private async fetchFromOpenCnpj(taxId: string): Promise<CnpjLookupResponseDTO> {
    const response = await fetch(`${OPEN_CNPJ_API}/${taxId}`, { headers: FETCH_HEADERS });

    if (response.status === 404) {
      throw new LookupError.NotFound("CNPJ não encontrado na base pública");
    }

    if (!response.ok) {
      throw new Error(`Consulta CNPJ indisponível (${response.status})`);
    }

    const data = (await response.json()) as OpenCnpjResponse;
    return this.mapOpenCnpjResponse(data, taxId);
  }

  private mapBrasilApiResponse(data: BrasilApiCnpjResponse, taxId: string): CnpjLookupResponseDTO {
    return {
      razaoSocial: data.razao_social ?? "",
      nomeFantasia: data.nome_fantasia?.trim() || data.razao_social || "",
      cnpj: taxId,
      logradouro: data.logradouro ?? "",
      numero: data.numero?.trim() || "SN",
      complemento: data.complemento?.trim() || undefined,
      bairro: data.bairro ?? "",
      municipio: data.municipio ?? "",
      codigoMunicipio: data.codigo_municipio_ibge ? String(data.codigo_municipio_ibge) : "",
      uf: (data.uf ?? "").toUpperCase(),
      cep: (data.cep ?? "").replace(/\D/g, ""),
      telefone: data.ddd_telefone_1?.replace(/\D/g, "") || undefined,
      crt: inferTaxRegimeCode(data.opcao_pelo_simples, data.opcao_pelo_mei),
    };
  }

  private async mapOpenCnpjResponse(
    data: OpenCnpjResponse,
    taxId: string,
  ): Promise<CnpjLookupResponseDTO> {
    const phone = data.telefones?.[0];
    const postalCode = (data.cep ?? "").replace(/\D/g, "");

    let municipalityCode = "";
    let municipality = data.municipio ?? "";
    let state = (data.uf ?? "").toUpperCase();

    if (postalCode.length === 8) {
      try {
        const cepData = await this.cepLookup.lookup(postalCode);
        if (cepData.codigoMunicipio) municipalityCode = cepData.codigoMunicipio;
        if (!municipality) municipality = cepData.municipio;
        if (!state) state = cepData.uf;
      } catch {
        // IBGE enrichment via CEP is optional
      }
    }

    return {
      razaoSocial: data.razao_social ?? "",
      nomeFantasia: data.nome_fantasia?.trim() || data.razao_social || "",
      cnpj: taxId,
      logradouro: buildStreetAddress(data.tipo_logradouro, data.logradouro),
      numero: data.numero?.trim() || "SN",
      complemento: data.complemento?.trim() || undefined,
      bairro: data.bairro ?? "",
      municipio: municipality,
      codigoMunicipio: municipalityCode,
      uf: state,
      cep: postalCode,
      telefone: phone ? `${phone.ddd}${phone.numero}`.replace(/\D/g, "") : undefined,
      crt: inferTaxRegimeCode(data.opcao_simples, data.opcao_mei),
    };
  }
}

function inferTaxRegimeCode(simples?: boolean, mei?: boolean): number {
  if (simples || mei) return 1;
  return 3;
}

function buildStreetAddress(streetType?: string, streetName?: string): string {
  const type = streetType?.trim();
  const name = streetName?.trim();
  if (type && name) {
    const upperType = type.toUpperCase();
    if (name.toUpperCase().startsWith(upperType)) return name;
    return `${type} ${name}`.trim();
  }
  return name ?? type ?? "";
}

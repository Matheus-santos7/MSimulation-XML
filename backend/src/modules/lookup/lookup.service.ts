import { HttpException, Inject, Injectable } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import { LOGGER } from "../../nest/tokens.js";
import type { CepLookupResponseDTO } from "./dtos/cep-lookup.response.dto.js";
import type { CnpjLookupResponseDTO } from "./dtos/cnpj-lookup.response.dto.js";
import { LookupError } from "./errors/lookup.errors.js";
import { CepLookupProvider } from "./providers/cep-lookup.provider.js";
import { CnpjLookupProvider } from "./providers/cnpj-lookup.provider.js";

/** Tamanho aceito na rota, com ou sem máscara. */
const CNPJ_PARAM_LENGTH = { min: 14, max: 18 } as const;
const CEP_PARAM_LENGTH = { min: 8, max: 9 } as const;

type ParamRule = { min: number; max: number; message: string };

function assertParam(value: unknown, rule: ParamRule): string {
  if (typeof value !== "string" || value.length < rule.min || value.length > rule.max) {
    throw new LookupError.Invalid(rule.message);
  }

  return value;
}

/**
 * Consulta CNPJ e CEP em APIs públicas (onboarding e cadastros).
 * Erros conhecidos saem como 400/404; falha da API externa sai como 502 com a mensagem original.
 */
@Injectable()
export class LookupService {
  constructor(
    @Inject(CnpjLookupProvider) private readonly cnpjProvider: CnpjLookupProvider,
    @Inject(CepLookupProvider) private readonly cepProvider: CepLookupProvider,
    @Inject(LOGGER) private readonly logger: FastifyBaseLogger,
  ) {}

  lookupCnpj(rawCnpj: unknown): Promise<CnpjLookupResponseDTO> {
    const cnpj = assertParam(rawCnpj, { ...CNPJ_PARAM_LENGTH, message: "CNPJ inválido" });

    return this.withUpstreamErrors(() => this.cnpjProvider.lookup(cnpj), "Falha ao consultar CNPJ");
  }

  lookupCep(rawCep: unknown): Promise<CepLookupResponseDTO> {
    const cep = assertParam(rawCep, { ...CEP_PARAM_LENGTH, message: "CEP inválido" });

    return this.withUpstreamErrors(() => this.cepProvider.lookup(cep), "Falha ao consultar CEP");
  }

  private async withUpstreamErrors<T>(run: () => Promise<T>, fallbackMessage: string): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(error);
      throw new LookupError.Upstream(error instanceof Error ? error.message : fallbackMessage);
    }
  }
}

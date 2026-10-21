import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import type { FastifyBaseLogger, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { HttpError } from "../../../../lib/http/http-error.js";
import { AuthenticatedApi } from "../../../../nest/api-access.decorators.js";
import { LookupNotFoundError } from "../../domain/errors/lookup-not-found.error.js";
import { LookupValidationError } from "../../domain/errors/lookup-validation.error.js";
import { LOOKUP, type LookupContext } from "../../lookup.tokens.js";
import { cepParamSchema, cnpjParamSchema } from "../schemas/lookup.schemas.js";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;

/** Traduz falhas do lookup; erro de API externa vira 502 com a mensagem original. */
function toLookupHttpError(
  error: unknown,
  messages: { invalid: string; fallback: string },
  log: FastifyBaseLogger,
): HttpError {
  if (error instanceof LookupNotFoundError) return new HttpError(HTTP_NOT_FOUND, error.message);
  if (error instanceof LookupValidationError) return new HttpError(HTTP_BAD_REQUEST, error.message);
  if (error instanceof ZodError) return new HttpError(HTTP_BAD_REQUEST, messages.invalid);

  log.error(error);

  return new HttpError(
    HTTP_BAD_GATEWAY,
    error instanceof Error ? error.message : messages.fallback,
  );
}

/**
 * Lookup CNPJ/CEP: só JWT, sem tenant (onboarding) e sem transação.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/lookup/cnpj/:cnpj` | LookupCnpjUseCase |
 * | GET | `/lookup/cep/:cep` | LookupCepUseCase |
 */
@Controller("lookup")
@AuthenticatedApi()
export class LookupController {
  constructor(@Inject(LOOKUP) private readonly lookup: LookupContext) {}

  @Get("cnpj/:cnpj")
  async cnpj(@Param() params: unknown, @Req() request: FastifyRequest) {
    try {
      const { cnpj } = cnpjParamSchema.parse(params);

      return await this.lookup.lookupCnpj.execute(cnpj);
    } catch (error) {
      throw toLookupHttpError(
        error,
        { invalid: "CNPJ inválido", fallback: "Falha ao consultar CNPJ" },
        request.log,
      );
    }
  }

  @Get("cep/:cep")
  async cep(@Param() params: unknown, @Req() request: FastifyRequest) {
    try {
      const { cep } = cepParamSchema.parse(params);

      return await this.lookup.lookupCep.execute(cep);
    } catch (error) {
      throw toLookupHttpError(
        error,
        { invalid: "CEP inválido", fallback: "Falha ao consultar CEP" },
        request.log,
      );
    }
  }
}

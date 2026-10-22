import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";

const HTTP_BAD_GATEWAY = 502;

/** Erros da consulta de CNPJ e CEP. O filtro global responde `{ error: message }` com o status. */
export namespace LookupError {
  /** Documento inexistente na base consultada (404). */
  export class NotFound extends NotFoundException {}

  /** Documento em formato inválido ou recusado pela API pública (400). */
  export class Invalid extends BadRequestException {}

  /** API pública indisponível ou com resposta inesperada (502, mensagem original). */
  export class Upstream extends HttpException {
    constructor(message: string) {
      super(message, HTTP_BAD_GATEWAY);
    }
  }
}

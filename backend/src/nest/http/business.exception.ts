import { HttpException } from "@nestjs/common";

const HTTP_UNPROCESSABLE_ENTITY = 422;

/**
 * Regra de negócio violada. O `ApiExceptionFilter` responde `{ error: message }` com o status
 * (422 por padrão). A mensagem vai para o usuário: escreva em português.
 */
export class BusinessException extends HttpException {
  constructor(message: string, status: number = HTTP_UNPROCESSABLE_ENTITY) {
    super(message, status);
    this.name = "BusinessException";
  }
}

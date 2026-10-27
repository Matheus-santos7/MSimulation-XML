import {
  BadRequestException,
  ConflictException,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";
import { AUTH_GENERIC_LOGIN_ERROR } from "../../../lib/auth/config.js";

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;

/** Mensagem ao usuário quando o envio de e-mail falha (o detalhe fica em `detail`). */
export const EMAIL_DELIVERY_FAILED_MESSAGE =
  "Não foi possível enviar o e-mail. Tente novamente em instantes.";

/** Erros do contexto de autenticação. O filtro responde `{ error: message }` com o status. */
export namespace AuthError {
  /** Credenciais ou sessão inválidas (401). */
  export class Unauthorized extends UnauthorizedException {
    constructor(message: string = AUTH_GENERIC_LOGIN_ERROR) {
      super(message);
    }
  }

  /** Código TOTP ausente, inválido ou sessão de verificação expirada (401). */
  export class TwoFactorRequired extends UnauthorizedException {
    constructor(message = "Código de autenticação inválido") {
      super(message);
    }
  }

  /** Conta bloqueada pelo lockout de tentativas (429). */
  export class TooManyRequests extends HttpException {
    constructor(message: string) {
      super(message, HTTP_TOO_MANY_REQUESTS);
    }
  }

  /** Conflito de cadastro (409). */
  export class Conflict extends ConflictException {}

  /** Operação incompatível com o estado da conta (400). */
  export class State extends BadRequestException {}

  /** Link de redefinição de senha inválido, usado ou expirado (400). */
  export class PasswordResetInvalid extends BadRequestException {
    constructor(message = "Link inválido ou expirado. Solicite um novo e-mail.") {
      super(message);
    }
  }

  /** Link de confirmação de e-mail inválido, usado ou expirado (400). */
  export class EmailVerificationInvalid extends BadRequestException {
    constructor(message = "Link inválido ou expirado. Solicite um novo e-mail.") {
      super(message);
    }
  }

  /** Falha no envio de e-mail transacional (503 com mensagem fixa; o motivo fica em `detail`). */
  export class EmailDelivery extends HttpException {
    constructor(readonly detail: string) {
      super(EMAIL_DELIVERY_FAILED_MESSAGE, HTTP_SERVICE_UNAVAILABLE);
    }
  }
}

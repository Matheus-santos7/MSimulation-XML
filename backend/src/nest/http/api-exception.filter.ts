import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import { resolveRouteError, type RouteErrorOptions } from "../../lib/http/domain-errors.js";
import { resolveErrorResponse } from "../../lib/http/error-handler.js";
import { HttpError, type ErrorResponse } from "../../lib/http/http-error.js";

/**
 * Filtro global: contrato de erro da API (`{ error }`, 400 Zod, 503 banco indisponível,
 * P2002/P2025, 5xx genérico). Também recebe os erros do Fastify fora do pipeline do Nest.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const { status, body } = this.resolve(exception, request.log);
    if (reply.sent) {
      request.log.error({ err: exception }, "Erro depois da resposta enviada");
      return;
    }

    void reply.status(status).send(body);
  }

  protected resolve(exception: unknown, log: FastifyBaseLogger): ErrorResponse {
    if (exception instanceof HttpError) {
      return { status: exception.status, body: exception.body ?? { error: exception.message } };
    }
    if (exception instanceof HttpException) {
      return { status: exception.getStatus(), body: { error: exception.message } };
    }

    return resolveErrorResponse(exception, log);
  }
}

/**
 * Filtro de controller: aplica os mapeamentos de erro de domínio da rota
 * (`resolveRouteError`) e cai no contrato global para o resto.
 */
@Catch()
export class RouteErrorFilter extends ApiExceptionFilter {
  constructor(private readonly options: RouteErrorOptions) {
    super();
  }

  protected override resolve(exception: unknown, log: FastifyBaseLogger): ErrorResponse {
    return resolveRouteError(exception, this.options) ?? super.resolve(exception, log);
  }
}

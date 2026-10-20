import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { from, lastValueFrom, type Observable } from "rxjs";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { runWithDbContext, type DbRequestContext } from "../../lib/db/tenant-rls.js";
import { PRISMA } from "../tokens.js";

/**
 * Executa o handler dentro de `runWithDbContext` (transação + `app.tenant_id`/`app.user_id`
 * para a RLS), como o `wrapRouteWithDbContext` das rotas Fastify.
 *
 * `next.handle()` é chamado dentro da transação: o Nest amarra o handler ao
 * AsyncLocalStorage ativo nesse momento, e `getDbClient()` enxerga a transação.
 */
@Injectable()
export class DbContextInterceptor implements NestInterceptor {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    // `user` só existe depois do JwtAuthGuard; rotas públicas do auth rodam sem ele.
    const user = request.user as FastifyRequest["user"] | undefined;
    const dbContext: DbRequestContext = {
      userId: user?.userId,
      tenantId: user?.tenantId ?? undefined,
    };

    return from(
      runWithDbContext(this.prisma, dbContext, () => lastValueFrom(next.handle(), { defaultValue: undefined })),
    );
  }
}

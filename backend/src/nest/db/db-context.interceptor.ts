import type { FastifyRequest } from "fastify";
import {
  Inject,
  Injectable,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { from, lastValueFrom, type Observable } from "rxjs";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { runWithDbContext, type DbRequestContext } from "../../lib/db/tenant-rls.js";
import { PRISMA } from "../tokens.js";

const SKIP_DB_CONTEXT_METADATA = "api:skip-db-context";

/**
 * Faz a rota de um controller `@ProtectedApi()` rodar SEM a transação do interceptor. Os guards
 * e o rate limit continuam valendo. Serve para rota que gasta tempo antes de tocar no banco
 * (upload, parse de planilha): sem isso, ela segura uma conexão do pool durante todo esse tempo.
 *
 * Cuidado: a rota fica sem `getDbClient()`. Qualquer acesso ao banco precisa estar dentro de
 * `runWithDbContext(prisma, { tenantId, userId }, fn)` aberto por ela mesma; fora dele o
 * repository lança "Database client accessed outside of an active transaction".
 */
export const SkipDbContext = () => SetMetadata(SKIP_DB_CONTEXT_METADATA, true);

/**
 * Executa o handler dentro de `runWithDbContext` (transação + `app.tenant_id`/`app.user_id`
 * para a RLS na mesma conexão física).
 *
 * `next.handle()` é chamado dentro da transação: o Nest amarra o handler ao
 * AsyncLocalStorage ativo nesse momento, e `getDbClient()` enxerga a transação.
 */
@Injectable()
export class DbContextInterceptor implements NestInterceptor {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_DB_CONTEXT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    // `user` só existe depois do JwtAuthGuard; rotas públicas do auth rodam sem ele.
    const user = request.user as FastifyRequest["user"] | undefined;
    const dbContext: DbRequestContext = {
      userId: user?.userId,
      tenantId: user?.tenantId ?? undefined,
    };

    return from(
      runWithDbContext(this.prisma, dbContext, () =>
        lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    );
  }
}

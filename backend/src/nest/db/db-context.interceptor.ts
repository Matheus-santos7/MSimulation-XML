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
import {
  runWithDbContext,
  runWithPooledDbClient,
  type DbRequestContext,
} from "../../lib/db/tenant-rls.js";
import { PRISMA } from "../tokens.js";

const SKIP_DB_CONTEXT_METADATA = "api:skip-db-context";
const POOLED_DB_CONTEXT_METADATA = "api:pooled-db-context";

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
 * Rota sem transação: cada query do handler roda sozinha no pool, sem segurar conexão durante o
 * trabalho que não usa o banco (scrypt, CAPTCHA, atraso contra enumeração). Só para rota que toca
 * tabelas fora da RLS (`users`, sessões) e cujas escritas não precisam ser atômicas entre si.
 */
export const PooledDbContext = () => SetMetadata(POOLED_DB_CONTEXT_METADATA, true);

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
    const pooled = this.reflector.getAllAndOverride<boolean | undefined>(
      POOLED_DB_CONTEXT_METADATA,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    // `user` só existe depois do JwtAuthGuard; rotas públicas do auth rodam sem ele.
    const user = request.user as FastifyRequest["user"] | undefined;
    const dbContext: DbRequestContext = {
      userId: user?.userId,
      tenantId: user?.tenantId ?? undefined,
    };

    const handle = () => lastValueFrom(next.handle(), { defaultValue: undefined });
    if (pooled) return from(runWithPooledDbClient(this.prisma, dbContext, handle));

    return from(runWithDbContext(this.prisma, dbContext, handle));
  }
}

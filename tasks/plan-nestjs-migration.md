# Plano — migração do backend para NestJS

## Ponto de partida (levantado no código em 2026-10-20)

| Item | Hoje |
|---|---|
| HTTP | Fastify 5 puro, plugins encapsulados (`plugins/protected-api.ts`, `plugins/contexts/*.plugin.ts`) |
| Rotas | 96 rotas (sem os HEAD automáticos; lista em `backend/src/app.contract.routes.txt`) em 12 módulos (`auth`, `catalog`, `fiscal-documents`, `fiscal-settings`, `fiscal-validation`, `health`, `logistics`, `lookup`, `org`, `remessas`, `sales`, `tax`) |
| Camadas | Hexagonal por módulo: `domain/` (ports, entities, services), `application/use-cases`, `infrastructure/` (prisma, fiscal, factory), `presentation/` (controllers, schemas, mappers) |
| DI | Composition root manual: `create<X>Module()` em `infrastructure/factory/*.factory.ts` |
| Banco | Prisma 7 + `@prisma/adapter-pg`, Postgres (Neon) com **RLS**: cada rota protegida roda dentro de `runWithDbContext` (transação + `set_config('app.tenant_id')`), via hook `onRoute` (`lib/db/wrap-protected-route.ts`) |
| Auth | `@fastify/jwt` + decorator `app.authenticate` (confere `tokenVersion` no banco); hooks `requireTenantHook`, `requireEmailVerifiedHook`, `requireAdminHook` |
| Validação | Zod nos `presentation/schemas`; `ZodError` vira `{ error, details }` (o frontend lê isso em `ApiValidationError`) |
| Erros | `registerGlobalErrorHandler` + `handleRouteError` com mapeamentos por controller; corpo sempre `{ error: string }` em português |
| Extras | `@fastify/rate-limit` (global 300/min na API protegida, limites por rota no auth), `@fastify/multipart` (imports de planilha e XML), `@fastify/helmet`, `@fastify/cors` |
| Módulo | ESM (`"type": "module"`, `NodeNext`), dev com `tsx watch`, build `tsc`, `CMD node dist/index.js` |
| Testes | 52 arquivos `node --test` via `tsx`, focados em domínio |

## Decisões

1. **Migração incremental (strangler), sem big bang.** O Nest sobe com `FastifyAdapter` em cima da mesma instância Fastify. Os plugins legados continuam registrados nessa instância. Cada PR move um módulo para controllers do Nest e remove o plugin legado dele. Fastify recusa rota duplicada, então rota esquecida aparece no boot.
2. **Contrato HTTP congelado.** Mesmos paths, métodos, status e corpo (`{ error }`, `{ error, details }`). As mensagens continuam em português porque o frontend mostra o texto direto. Isso diverge da regra "mensagens em inglês" do CLAUDE.md; traduzir fica para depois, junto com o frontend.
3. **Domínio e aplicação continuam sem Nest.** Os use cases e ports não recebem decorators. O módulo Nest monta tudo com `useFactory`, substituindo `create<X>Module()`. Assim a DI não depende de `emitDecoratorMetadata` nas camadas internas e os 52 testes atuais não mudam.
4. **Continua Zod.** Um `ZodValidationPipe` (cerca de 20 linhas, reaproveitando `sendZodValidationError`) no lugar de `class-validator`. Reescrever 79 schemas não traz ganho e arrisca mudar o contrato.
5. **Do `ARCHITECTURE.md` dos Nérus Microservices, não entram:** MySQL/ZenStack, o kernel privado `@eac-nerus/microservices` (`BaseRepository`, `AsyncContext`), tenant vindo do header `x-tenant-code`. Aqui o tenant vem do JWT e o isolamento é a RLS do Postgres. **Entram:** feature module, controller fino, use case com `execute`, exceção HTTP só na borda, Vitest + SWC para specs novas.
6. **Build com SWC.** O `tsx`/esbuild não emite metadata de decorators. Dev passa a ser `nest start --watch` com o builder SWC. Build continua `tsc` (via `nest build`), mantendo ESM e os imports `.js`.

## Peças de infraestrutura (equivalência)

| Hoje | No Nest |
|---|---|
| `src/index.ts` | `src/main.ts`: `NestFactory.create(AppModule, new FastifyAdapter(fastify))`, helmet, cors, `enableShutdownHooks()` |
| `plugins/prisma.ts` | `PrismaModule` (`@Global`) com `PrismaService` envolvendo o singleton de `lib/db/prisma.ts` e `onModuleDestroy` |
| `app.authenticate` | `JwtAuthGuard`. Na convivência ele chama `request.jwtVerify()` do `@fastify/jwt` já registrado, e checa `tokenVersion` igual ao atual |
| `requireTenantHook` / `requireEmailVerifiedHook` / `requireAdminHook` | `TenantGuard`, `EmailVerifiedGuard`, `RolesGuard` + `@Roles("ADMIN")`; `@Public()` e `@NoTenant()` para health, auth e lookup |
| `wrapProtectedRouteWithDbContext` (`onRoute`) | `DbContextInterceptor`: `from(runWithDbContext(prisma, ctx, () => lastValueFrom(next.handle())))`. Guards rodam antes de interceptors, a mesma ordem dos hooks `onRequest` atuais |
| `registerGlobalErrorHandler` + `handleRouteError` | `HttpExceptionFilter` global com a mesma tabela (Zod 400, banco indisponível 503, P2002 409, P2025 404, 5xx genérico) + mapa de erros de domínio por módulo (`ORDER_ERROR_MAPPINGS` etc.) |
| `tenantIdFromRequest(req)` | `@CurrentUser()` / `@TenantId()` param decorators |
| `@fastify/rate-limit` por escopo | Plugin continua na instância; limites por rota com `@RouteConfig({ rateLimit })` de `@nestjs/platform-fastify` |
| `@fastify/multipart` | Continua registrado; controller usa `@Req() req: FastifyRequest` e `req.file()`, com os helpers atuais |
| `registerFiscalTransactionCommitHook` em `fiscal.plugin.ts` | `onModuleInit` do `FiscalDocumentsModule`, com `Logger` do Nest |

## Fases

### Fase 0 — Rede de segurança (PR 1, sem Nest ainda) — feita na branch `test/http-contract-baseline`

- `src/app.ts` com `buildApp()`; `src/index.ts` só escuta a porta. `plugins/prisma.ts` aceita client injetado.
- `src/app.contract.test.ts` (26 casos, Prisma fake, sem banco): 401 sem token em toda rota protegida, 403 sem empresa em toda rota de negócio, 403 e-mail não confirmado, 403 ADMIN, 401 `tokenVersion`, listas vazias por módulo, 404, 400 Zod `{ error, details }`, health ok/503, 503 de banco indisponível.
- Snapshot `src/app.contract.routes.txt` com as 96 rotas. Cada PR de migração tem que manter o snapshot igual (`UPDATE_CONTRACT_SNAPSHOT=1` só para mudança intencional).
- Observação para a fase 14: o `auth.controller.ts` também envolve as próprias rotas em `wrapRouteWithDbContext` (com `userId` opcional), então o `DbContextInterceptor` vale para o auth também.

### Fase 1 — Fundação (PR 2)

- Dependências: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify`, `reflect-metadata`, `rxjs`; dev: `@nestjs/cli`, `@nestjs/testing`, `@swc/core`, `vitest`, `unplugin-swc`.
- `tsconfig`: `experimentalDecorators`, `emitDecoratorMetadata`. `nest-cli.json` com builder SWC.
- `main.ts` + `AppModule` + `PrismaModule` + guards + `DbContextInterceptor` + filter + pipe, todos com spec Vitest.
- Plugins legados registrados na instância via `getHttpAdapter().getInstance()`. Nenhuma rota muda de lugar.
- `Dockerfile`: `CMD ... node dist/main.js`. O `HEALTHCHECK` em `/api/health` continua igual.
- Critério: os 52 testes, o contrato e o snapshot de rotas passam; a imagem sobe em produção sem diferença visível.

### Fase 2 — Módulos, do menor risco ao maior (1 PR por linha)

| # | Módulo | Rotas | Atenção |
|---|---|---|---|
| 3 | `health` | 1 | Sem guard; resposta 503 mantém o corpo `degraded` |
| 4 | `lookup` | 2 | `@NoTenant()`: só JWT, como em `authenticated-lookup.ts` |
| 5 | `fiscal-settings` | 3 | |
| 6 | `tax` | 5 | Import de planilha (multipart) |
| 7 | `catalog` | 9 | Import de planilha (multipart) |
| 8 | `logistics` | 10 | Bulk import |
| 9 | `org` | 16 | Rotas ADMIN |
| 10 | `fiscal-validation` | 3 | Hoje recebe `nfeXmlResolver` por parâmetro; vira provider exportado |
| 11 | `remessas` | 0 | Só providers (FIFO, emissor, adapters), exportados para `sales` e `fiscal-documents` |
| 12 | `fiscal-documents` | 23 | Commit hook do backfill; XML/planilha; observabilidade |
| 13 | `sales` | 8 | Mapeamento de `SaldoRemessaInsuficienteError` (422 com `disponivel`/`solicitado`) |
| 14 | `auth` | 15 | Por último: rate limit por rota, 2FA, refresh. A troca de `@fastify/jwt` por `@nestjs/jwt` é opcional e fica para este PR |

Roteiro de cada PR:

1. Criar `<modulo>/<modulo>.module.ts` com providers via `useFactory` (porta da `*.factory.ts`).
2. Reescrever `presentation/controllers/*.controller.ts` como `@Controller`, chamando os mesmos use cases.
3. Remover o registro do plugin legado em `plugins/contexts/*.plugin.ts` e apagar a factory.
4. Spec Vitest do controller com `Test.createTestingModule` e use cases falsos.
5. Rodar o contrato, o snapshot de rotas, `pnpm test`, `tsc` e um smoke manual das telas do módulo no frontend.

### Fase 3 — Limpeza (PR 15)

- Remover `plugins/`, `fastify-plugin`, `wrap-protected-route.ts`, `types/fastify.d.ts` (o que sobrar) e `tsx` do dev.
- Regra no `.dependency-cruiser.js`: `domain/` e `application/` não importam `@nestjs/*` nem `fastify`.
- Atualizar `backend/README.md` e o `CLAUDE.md` da raiz, que hoje descreve outro repositório.
- Opcional: portar os 52 testes `node:test` para Vitest e unificar o runner.

## Riscos

| Risco | Mitigação |
|---|---|
| RLS fora da transação (`getDbClient()` lança "accessed outside of an active transaction") | Spec do `DbContextInterceptor` que confere `app.tenant_id` dentro do handler; teste de contrato com dois tenants |
| `AsyncLocalStorage` perdido entre RxJS e o handler | `lastValueFrom(next.handle())` dentro do `run`; coberto pela spec acima |
| Corpo de erro diferente quebra o frontend | Filter reproduz `error-handler.ts` linha a linha; teste de contrato compara o corpo |
| Rate limit muda de escopo (hoje o auth tem limite próprio e a API protegida tem 300/min) | Registrar com `global: false` e declarar `@RouteConfig` explícito; teste de 429 no login |
| ESM + Nest + Prisma 7 gerado em `src/generated` | Validar na fase 1 com `nest build` e `node dist/main.js` dentro da imagem |
| Disco do servidor apertado (cerca de 60% em `/var/lib/docker`) | A imagem cresce pouco; conferir o espaço antes do deploy da fase 1 |

## Pendente de decisão

- Manter as mensagens em português (recomendado agora) ou traduzir junto com o frontend.
- Trocar `@fastify/jwt` por `@nestjs/jwt` no PR do auth ou manter.
- Portar os testes antigos para Vitest na fase 3 ou deixar dois runners.

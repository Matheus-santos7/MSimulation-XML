---
paths:
  - "backend/src/index.ts"
  - "backend/src/app.ts"
  - "backend/src/nest/*.module.ts"
  - "**/config/config.service.ts"
  - "**/config/config.module.ts"
---

# Bootstrap e contexto

`src/index.ts` só chama `buildApp()`, liga `enableShutdownHooks()` e escuta a porta. A montagem fica em `src/app.ts`:

1. Instância Fastify com helmet, CORS, `@fastify/rate-limit` (sem limite global), multipart (15 MB, 1 arquivo), Prisma e `@fastify/jwt`.
2. `AppModule.register({ prisma, logger, jwt, rateLimits })`.
3. `NestFactory.create(AppModule, new FastifyAdapter(fastify), { bodyParser: false })`, `setGlobalPrefix("api")`, `useGlobalFilters(new ApiExceptionFilter())`, `init()`.

- `buildApp({ prisma, logger })` aceita dependências injetáveis: é o que o contrato HTTP usa nos testes. Não leia infraestrutura global dentro dos módulos.
- Feature nova entra em `FEATURE_MODULES` (`src/nest/app.module.ts`), não no `app.ts`.
- `CoreModule` é `@Global()` e expõe os tokens `PRISMA`, `RATE_LIMITS`, `LOGGER`, `JWT` e o `ConfigService`.
- `ConfigService` (`src/config/config.service.ts`): um getter por variável, lido na hora do acesso. Dentro do Nest, `@Inject(ConfigService)`; fora (`lib/`, bootstrap), `appConfig`. Variável nova entra como getter; validação e default ficam no `config.ts` da área (`lib/auth/config.ts`). Fora do `ConfigService`, ninguém lê `process.env`.
- Tenant e usuário vêm do JWT, não de header. Os guards validam token, tenant, e-mail verificado e papel; o `DbContextInterceptor` abre a transação e aplica `set_config('app.tenant_id')` e `set_config('app.user_id')`.
- O use case lê o contexto com `getDbRequestContext()`; o controller usa `@TenantId()`, `@UserId()` ou `@CurrentUser()`.
- Acesso declarado no controller: `@ProtectedApi()` (JWT + tenant + e-mail + rate limit 300/min + transação), `@AuthenticatedApi()` (só JWT), `@AdminOnly()` por método.

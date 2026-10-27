# Migração do backend para NestJS — registro

Branch `test/http-contract-baseline`, criada a partir de `fix/prod-db-connect-and-frontend-health` (54fe1d8). Concluída em 2026-10-20. Nada foi publicado nem implantado.

## Resultado

As 96 rotas (lista em `backend/src/app.contract.routes.txt`) agora são controllers NestJS 11 sobre Fastify 5. Nenhuma rota Fastify sobrou. Os paths, status e corpos de resposta continuam iguais. Quem garante isso é `backend/src/app.contract.test.ts` (85 casos), que rodou contra o código antigo antes de cada módulo ser migrado e contra o novo depois.

| Commit | Fase |
|---|---|
| 5ed394f | 0 — `buildApp()`, contrato HTTP e snapshot de rotas |
| a46a3b2 | 1 — base do Nest: guards, interceptors de RLS e rate limit, filtros e pipe Zod |
| 1eea87c … 59fe125 | 2 — um commit por módulo: health, lookup, fiscal-settings, tax, catalog, logistics (+ remessas), org, fiscal-validation, fiscal-documents, sales, auth |
| 2d9dad1 | 3 — remoção do código Fastify legado e regra de camadas |

Verificação final: `pnpm test` com 380 testes passando, `tsc` de `src` e dos testes, `eslint`, `pnpm depcheck`, `pnpm build`, e o servidor compilado (`node dist/index.js`) respondendo.

## Como ficou

| Peça | Onde |
|---|---|
| Montagem | `src/app.ts`: instância Fastify (helmet, CORS, rate limit na raiz, multipart, Prisma, JWT) → `FastifyAdapter` → `AppModule`, prefixo `/api` |
| Núcleo Nest | `src/nest/`: `CoreModule` (tokens `PRISMA`, `RATE_LIMITS`, `LOGGER`, `JWT`), guards, `DbContextInterceptor`, `RateLimitInterceptor`, `ApiExceptionFilter`/`RouteErrorFilter`, `ZodValidationPipe` |
| Acesso | `@ProtectedApi()`, `@AuthenticatedApi()` e `@AdminOnly()` em `src/nest/api-access.decorators.ts` |
| Módulos | `src/modules/<ctx>/<ctx>.module.ts` + `<ctx>.tokens.ts`. O composition root existente (`create<Ctx>Module()`) virou provider por `useFactory` |
| Regras compartilhadas | `lib/auth/access-control.ts` (JWT, tenant, e-mail, ADMIN), `lib/http/rate-limit.ts`, `lib/http/http-error.ts` |
| Camadas | `src/architecture.test.ts` e a regra `core-no-nest-layer` do dependency-cruiser: `domain/` e `application/` não importam Nest nem Fastify |

## Onde a execução se afastou do plano

1. **Sem SWC e sem Vitest.** A DI usa `@Inject(TOKEN)` explícito em todo construtor, então não depende de `emitDecoratorMetadata`. Com isso o `tsx` (dev e testes) e o `node:test` continuam como estavam, e os testes antigos não precisaram ser portados. O `run-tests.sh` passou a usar `TSX_TSCONFIG_PATH=tsconfig.test.json`, porque o `tsconfig.json` exclui `*.test.ts`.
2. **As factories ficaram.** Cada `create<Ctx>Module()` continua como composition root, e o Nest injeta o objeto inteiro (por exemplo, `@Inject(SALES) sales: SalesContext`). Trocar por um provider por use case teria mexido na infraestrutura interna dos módulos (remessas monta adapters por dentro) sem ganho de comportamento.
3. **O `@fastify/jwt` ficou.** O `JwtAuthGuard` usa `request.jwtVerify()`, e o auth assina tokens pelo token `JWT`.
4. **O rate limit agora é um interceptor, não um hook.** Ele roda depois dos guards, como os hooks antigos: requisição recusada por JWT, tenant ou papel não entra na contagem. O limite de 300/min continua um pool só, compartilhado por todas as rotas protegidas. As rotas de auth mantêm limite próprio com `ban: 0` (a primeira requisição acima do limite recebe 403).
5. **O hook de pós-commit fiscal mudou de lugar.** Ele é registrado no `onModuleInit` do `FiscalValidationModule` e loga pelo pino.

## Diferenças de comportamento (intencionais e pequenas)

- **404 de rota inexistente:** antes `{ message, error, statusCode }`, o padrão do Fastify. Agora `{ "error": "Cannot GET /api/x" }`, no mesmo formato do resto da API.
- **Ordem de validação em alguns POST com corpo inválido:** o parser de JSON roda antes dos guards (já era assim no Fastify), então nada muda para o frontend. O contrato cobre JSON malformado.

## Achado: rate limit do lookup nunca funcionou

O `lookupRateLimitPlugin` registrava o `@fastify/rate-limit` num escopo filho sem rotas, então `/api/lookup/cnpj` e `/api/lookup/cep` nunca tiveram limite em produção. A migração **manteve** esse comportamento. O limite pretendido (30/min, `ban: 0`) está documentado em `modules/lookup/infrastructure/http/lookup-rate-limit.ts`. Para ligar, basta adicionar `@RateLimit(lookupRouteRateLimit)` e `@UseInterceptors(RateLimitInterceptor)` no `LookupController` e ajustar o caso correspondente no contrato.

## Pendente de decisão

- Ligar o rate limit do lookup (acima).
- Mensagens de erro continuam em português, porque o frontend mostra o texto direto. Traduzir exige mudar o frontend junto.
- O `CLAUDE.md` da raiz (não versionado) e o `.claude/ARCHITECTURE.md` descrevem os Nérus Microservices (MySQL, ZenStack, kernel `@eac-nerus`), não este repositório. Vale ajustar antes de usar esses arquivos como contrato aqui.
- Violação de camada que já existia antes da migração: `catalog/application/services/validate-product-import-row.service.ts` importa um schema de `presentation/`.

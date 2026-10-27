# Arquitetura — MSimulation XML

Contrato para código novo no backend. A forma de organizar e escrever código vem dos Nérus Microservices (feature module NestJS, service + use case + repository, entidade com `create`/`restore`, DTOs nomeados, `BusinessException`, Vitest). O banco é outro: **PostgreSQL com Row-Level Security**, não MySQL.

O código é a fonte da verdade. A seção 12 diz onde o código ainda difere deste documento e por quê.

## 1. Tech stack

| Camada | Tecnologia | Onde aparece |
|---|---|---|
| Monorepo | pnpm workspaces: `backend`, `frontend`, `packages/*` | `pnpm-workspace.yaml` |
| Linguagem | TypeScript strict, ESM (`"type": "module"`, `NodeNext`) | `backend/tsconfig.json` |
| Runtime | Node 24 | `.github/workflows/ci.yml`, `Dockerfile` |
| HTTP | NestJS 11 sobre Fastify 5 (`@nestjs/platform-fastify`), prefixo `/api` | `backend/src/app.ts` |
| Validação | Zod: um schema por DTO em `<feature>/dtos/`, validado pelo `ZodValidationPipe` (decisão de 2026-10-22, no lugar do `class-validator`) | `dtos/*.request.dto.ts` |
| Contrato HTTP | `@nestjs/swagger` (`ApiTags`, `ApiResponse`); docs em `/api/docs` com `API_DOCS_ENABLED=true`. `@ApiProperty` sempre com `type` explícito | controllers e DTOs de resposta |
| Banco | **PostgreSQL** (Neon em produção) | `DATABASE_URL` |
| ORM | Prisma 7 + `@prisma/adapter-pg`, client gerado em `src/generated/prisma` | `backend/prisma/schema.prisma` |
| Multi-tenant | Coluna `tenant_id` + política RLS `tenant_isolation` + `set_config('app.tenant_id')` por transação | `backend/prisma/migrations`, `lib/db/tenant-rls.ts` |
| Auth | JWT (`@fastify/jwt`) emitido pelo módulo `auth`; guards Nest | `backend/src/nest/auth/` |
| Testes | Vitest (`*.spec.ts`) + `@nestjs/testing` | `backend/run-tests.sh`, `vitest.config.ts` |
| Lint | ESLint (flat config) + Prettier + dependency-cruiser | `backend/eslint.config.js`, `.prettierrc`, `.dependency-cruiser.js` |
| Fiscal | `@msimulation-xml/fiscal-core` e `@msimulation-xml/nfe-xml` (workspace) | `packages/` |
| CI/CD | GitHub Actions (lint, build, tsc dos testes, depcheck, testes, audit); deploy no Render e imagem Docker | `.github/workflows/` |

Não existe o kernel privado `@eac-nerus/microservices`. As peças equivalentes moram em `backend/src/nest/` (seção 3).

## 2. Pacotes do monorepo

| Diretório | Pacote | Papel |
|---|---|---|
| `backend/` | `@msimulation-xml/backend` | API NestJS. Único pacote com banco |
| `frontend/` | `@msimulation-xml/frontend` (Next.js) | Interface. Mostra as mensagens de erro da API direto ao usuário |
| `packages/fiscal-core` | `@msimulation-xml/fiscal-core` | Regras fiscais puras (sem Nest, sem Prisma) |
| `packages/nfe-xml` | `@msimulation-xml/nfe-xml` | Geração e leitura de XML de NF-e/CT-e |

É um serviço só, não microservices. Não há gateway nem chamada HTTP entre serviços internos. Um módulo usa outro importando o provider que o `@Module` dele exporta.

## 3. Estrutura de pastas (backend)

```
backend/
  prisma/
    schema.prisma               # fonte do schema (Postgres)
    migrations/<timestamp>_<nome>/migration.sql
  prisma.config.ts
  src/
    index.ts                    # bootstrap: buildApp() + listen
    app.ts                      # monta Fastify + NestFactory + AppModule
    config/                     # alvo: ConfigService, único leitor de process.env
    nest/                       # núcleo do app (papel do kernel @eac-nerus)
      core.module.ts            # @Global: PRISMA, RATE_LIMITS, LOGGER, JWT
      app.module.ts             # FEATURE_MODULES
      auth/                     # guards e param decorators (CurrentUser, TenantId, UserId)
      db/                       # DbContextInterceptor (transação + RLS)
      http/                     # filtros, pipes, rate limit, helpers de resposta
    entities/                   # alvo: entidades de domínio com create/restore
    modules/<contexto>/<feature>/   # contexto grande se divide em features (sales/order, sales/invoicing)
      <feature>.module.ts
      <feature>.controller.ts
      <feature>.service.ts
      <feature>.repository.ts
      dtos/
      use-cases/
      errors/                   # opcional
      rules/                    # regra pura do app (sem Nest, sem Prisma), opcional
      adapters/<marketplace>/   # o que muda por marketplace dentro da feature, opcional
      test/                     # specs ao lado do módulo
    providers/<destino>/        # cliente HTTP para API externa (CNPJ, CEP, SEFAZ...)
    lib/                        # infraestrutura compartilhada sem Nest (db, auth, http, e-mail)
    generated/prisma/           # client gerado. Não editar
```

Contexto pequeno (`health`, `lookup`) é uma feature só: `modules/<feature>/`. Contexto grande tem um `<contexto>.module.ts` que importa os módulos das features.

Regras fiscais que variam por marketplace ficam em `packages/fiscal-core/src/marketplaces/<marketplace>/`, uma pasta por marketplace com os mesmos arquivos. O backend nunca compara `marketplace === "..."`: pede o perfil ao `registry` e usa os campos dele.

Responsabilidade de cada camada:

| Pasta | Responsabilidade |
|---|---|
| `config` | Único lugar que lê `process.env` |
| `nest` | Guards, interceptors, filtros, pipes e classes base. Não conhece feature |
| `entities` | Estado de domínio. Sem Prisma, sem HTTP |
| `modules/<feature>` | Caso de uso HTTP daquele agregado |
| `dtos` | Contrato de entrada e saída. Sem regra de negócio |
| `use-cases` | Orquestração que cruza services, providers ou regras |
| `errors` | Exceções nomeadas do módulo |
| `providers` | Chamada HTTP para API externa |
| `lib/db` | `runWithDbContext`, `getDbClient`, `getDbRequestContext` (contexto de tenant e transação) |

`AppModule.register(...)` (`src/nest/app.module.ts`) recebe as dependências de infraestrutura e importa a lista `FEATURE_MODULES`. Feature nova entra nessa lista.

Kernel Nérus e o equivalente aqui:

| Kernel `@eac-nerus` | Aqui | Existe? |
|---|---|---|
| `initService`, `AppBaseModule` | `buildApp()` em `src/app.ts` + `AppModule.register` | sim |
| `AsyncContext` (tenant, usuário) | `getDbRequestContext()` em `lib/db/tenant-rls.ts`; `@TenantId()` / `@UserId()` no controller | sim |
| `PrismaService` | token `PRISMA`; dentro da request, `getDbClient()` devolve a transação com RLS | sim |
| `ClassValidatorPipe` | `ZodValidationPipe` (`src/nest/http/zod-validation.pipe.ts`) | sim |
| exception filter do `initService` | `ApiExceptionFilter` (global) e `RouteErrorFilter` | sim |
| `BaseRepository`, `BaseService`, `TenantIdEntity` | `src/nest/base/` | sim |
| `BusinessException` | `src/nest/http/business.exception.ts` (422 por padrão) | sim |
| `LoggingInterceptor` | o logger do Fastify (pino) já registra request e response; interceptor só se precisar de campos extras | não |
| `SuccessResponse`, `PaginatedResponse`, `paginationQuerySchema` | `src/nest/http/success-response.ts`, `src/nest/base/pagination.ts` | sim |
| `BaseProvider` | criar em `src/providers/` quando houver o segundo provider HTTP | não |

## 4. Padrões de projeto

Modular por feature (NestJS), com Clean Architecture leve.

| Padrão | Como aplicar |
|---|---|
| Feature module | Um agregado = um `@Module` com controller, service, repository e use cases |
| Template Method | `BrandService extends BaseService<BrandEntity>`, `BrandRepository extends BaseRepository<BrandEntity>` |
| Repository | Único acesso ao Prisma. Usa `getDbClient()` para rodar dentro da transação com RLS |
| Use Case | Classe `@Injectable` com um método `execute`. CRUD simples fica no service; fluxo que coordena vários services, providers ou regras vai para o use case |
| Factory da entidade | `private constructor`, `static create`, `static restore` |
| DTO | Schema Zod + tipo inferido (`create-brand.request.dto.ts`). Lista devolve `PaginatedResponse<T>` |
| Provider / Gateway | `extends BaseProvider`. URL base vem do `ConfigService` |
| Ambient context | Tenant e usuário vêm do JWT, entram no contexto pelo `DbContextInterceptor` e são lidos com `getDbRequestContext()` no use case, ou `@TenantId()` no controller |
| Soft enable | `enable` / `disable` atualizam `enabled`. Desligar é operação de primeira classe |
| Paginação | Query `offset` (página, default 1), `limit` (default 10, teto 100), `sort`, `filter` |
| Multi-tenant | `tenant_id` em toda tabela de negócio + política RLS. O repository também filtra por `tenantId` (defesa em profundidade) |
| Auditoria | `created_at`, `updated_at` (e `created_by` / `updated_by` quando o agregado precisa de autoria) |

SOLID:

- **S**: controller traduz HTTP; use case orquestra; repository persiste.
- **O**: comportamento novo entra como use case ou método no repository, sem reescrever a base.
- **L**: services e repositories substituem a base genérica e devolvem a entidade concreta via `restore`.
- **I**: provider expõe métodos pequenos (`lookupCnpj`, `getCep`), não um cliente HTTP genérico.
- **D**: use case depende de service ou provider injetado. Teste substitui com `as unknown as Tipo`.

## 5. Fluxo de uma requisição

```
Cliente (frontend Next.js)
  -> Fastify: helmet, CORS, parser JSON, multipart
  -> Nest (prefixo /api)
       Guards: JwtAuthGuard -> TenantGuard -> EmailVerifiedGuard -> AdminGuard
         (@ProtectedApi, @AuthenticatedApi, @AdminOnly)
       Interceptors: RateLimitInterceptor -> DbContextInterceptor
         abre transação, set_config('app.tenant_id' / 'app.user_id')
       Controller
         body: pipe de validação
         chama service OU useCase.execute
  -> Use case (quando o fluxo cruza agregados)
       lê getDbRequestContext() (tenantId, userId)
       chama services e providers
  -> Service extends BaseService
       Entity.create(dto)
       repository.insert / update / list
       mapeia para ResponseDTO (objeto literal)
  -> Repository extends BaseRepository
       getDbClient().<model>.<operação>   (mesma transação, RLS ativa)
       Entity.restore(row)
  -> commit da transação
  -> JSON do DTO, ou { success: true } em update/delete/enable/disable
  erro -> ApiExceptionFilter -> { error } ou { error, details }
```

Guards rodam antes dos interceptors: requisição recusada por JWT, tenant ou papel não abre transação nem conta no rate limit.

Lista paginada, no controller:

```ts
return this.brandListUseCase.execute({
  perPage: Math.min(limit, MAX_PAGE_SIZE),
  page: offset,
  sort,
  filter,
});
```

O use case traduz `filter.text` para `contains` com `mode: "insensitive"` (o Postgres diferencia maiúsculas por padrão) e devolve `IResponseWithPagination`. Monte a condição como objeto novo:

```ts
const where = {
  ...(text && { OR: [{ name: { contains: text, mode: "insensitive" } }] }),
  ...(enabled !== undefined && { enabled }),
};
```

## 6. Nomenclatura

| Coisa | Padrão | Exemplo |
|---|---|---|
| Arquivo | kebab-case | `brand-list.usecase.ts` |
| Classe | PascalCase | `BrandListUseCase` |
| Feature | singular | `brand`, `product-price` |
| Request | `create<X>RequestSchema` + `Create<X>RequestDTO` em `create-<x>.request.dto.ts` | `CreateBrandRequestDTO` |
| Response | `<X>ResponseDTO` | `BrandResponseDTO` |
| Lista | `<X>ResponseWithPagination` | `BrandResponseWithPagination` |
| Filtro | `Filter<X>DTO` | `FilterBrandDTO` |
| Resumo | `<X>ShortResponseDTO` | `BrandShortResponseDTO` |
| Use case | `<Feature><Ação>UseCase`, método `execute` | `ProductInsertUseCase` |
| Erro de negócio | `BusinessException` | `throw new BusinessException("Pedido sem nota fiscal")` |
| Erro nomeado (opcional) | `namespace <Feature>Error` + classe | `ProductError.NotFoundError` |
| Provider | `<destino>.provider.ts`, classe `<Destino>Provider` | `BrasilApiProvider` |
| Enum de status | SCREAMING_SNAKE string | `PedidoStatus.RASCUNHO` |
| Tabela | `@@map("plural_snake")` (padrão já usado no banco) | `@@map("products")` |
| Coluna | `@map("snake_case")` | `tenant_id`, `created_at` |
| Env no código | getter camelCase no `ConfigService` | `databaseUrl` lê `DATABASE_URL` |
| Import interno | relativo com sufixo `.js` (ESM NodeNext) | `../../nest/http/http-error.js` |

DTO usa `!` em campo obrigatório e `?` no opcional. Entidade de domínio usa o mesmo.

Termos do domínio fiscal ficam em português quando são nomes da legislação ou do layout da NF-e (`Pedido`, `Remessa`, `NFeTipo`, `serieCte`). O resto do código fica em inglês.

## 7. Tratamento de erros

Três níveis:

1. **Validação de entrada.** Pipe no `@Body` / `@Param` / `@Query`. Falha não chega no service. Resposta 400 `{ error, details }`.
2. **Erro de domínio.** `BusinessException` para regra violada; `NotFoundException`, `ConflictException`, `ForbiddenException` do Nest para status específico. Classe nomeada em `errors/` é opcional.
3. **Borda HTTP.** O `ApiExceptionFilter` global converte para `{ error: string }`: `HttpException` mantém o status, Zod vira 400 com `details`, banco indisponível vira 503, Prisma `P2002` vira 409, `P2025` vira 404, o resto vira 500 genérico sem stack.

Mensagens de erro em **português**, com inicial maiúscula (`"Produto não encontrado"`): o frontend mostra o texto direto ao usuário. Log técnico pode ser em inglês.

Não use `throw new Error(...)` para regra de negócio: vira 500. `catch` vazio é proibido. Log de aplicação usa `Logger` do Nest ou `request.log` (pino), nunca `console.log`.

## 8. Banco (PostgreSQL)

Fluxo:

1. Editar `backend/prisma/schema.prisma`. É a fonte do schema (não há ZenStack).
2. `pnpm --filter @msimulation-xml/backend exec prisma migrate dev --create-only --name <nome>`.
3. Revisar e completar o `migration.sql` gerado (RLS, índices, dados).
4. `pnpm --filter @msimulation-xml/backend db:generate`.
5. Aplicar em produção: `db:migrate:deploy`.

Modelo de negócio:

```prisma
model Brand {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  name      String   @db.VarChar(100)
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@map("brands")
}
```

- Id `String @id @default(uuid())`. Sequencial (`Int @id @default(autoincrement())`) só quando o negócio exige número.
- `tenantId` obrigatório em tabela de negócio, com índice. Tabelas de autenticação (`users`, sessões, tokens) ficam fora da RLS.
- Toda tabela nova com `tenant_id` entra na RLS na mesma migration:

```sql
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brands" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "brands";
CREATE POLICY tenant_isolation ON "brands" FOR ALL
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
```

- Valor monetário e alíquota em `Decimal @db.Decimal(p, s)`, nunca `Float` (o schema usa `Decimal(15, 2)` para valores e `Decimal(15, 8)` para preço unitário).
- Texto com limite do layout fiscal usa `@db.VarChar(n)` (`uf` 2, `cep` 8, `codigoMunicipio` 7).
- Busca textual: `contains` + `mode: "insensitive"`.
- Query que roda fora de request (job, script, seed) abre o contexto com `runWithDbContext(prisma, { tenantId }, fn)`. Sem isso, a RLS não devolve linhas.

## 9. Formatação

O `.prettierrc` da raiz manda: aspas duplas, ponto e vírgula, vírgula final em todo lugar, `printWidth: 100`, `arrowParens` padrão (`always`).

- Linha em branco antes de `return`, entre bloco de declaração e o resto, e antes de `if` / `for` / `try` quando o bloco anterior não é trivial.
- Imports: pacotes externos, depois `@nestjs/*` e `@msimulation-xml/*`, depois relativos.
- `tsconfig`: `strict: true`, `experimentalDecorators: true`.
- Número com significado vira constante nomeada (`HTTP_NOT_FOUND`, `MAX_PAGE_SIZE`).

## 10. Testes

- Unitário: `src/modules/<feature>/test/**/*.spec.ts`.
- Use case instanciado com dependências falsas (`vi.fn()`, `as unknown as Tipo`) ou via `Test.createTestingModule`.
- Contexto de tenant: rode o teste dentro de `dbRequestContext.run({ tenantId }, fn)` ou injete o leitor de contexto como dependência.
- Sem Postgres no unitário. Teste de integração com banco usa um Postgres descartável (Docker) e roda as migrations inteiras, RLS incluída.
- Contrato HTTP: `src/test/app.contract.spec.ts` sobe o app com Prisma falso e fixa status e corpo das rotas. Rota nova entra no snapshot (`UPDATE_CONTRACT_SNAPSHOT=1`).
- Cobertura mínima de 80% em código novo, sem contar `*.module.ts` e `index.ts`.

## 11. Comandos

Na raiz:

- `pnpm test:backend` (fiscal-core, nfe-xml e backend) · `pnpm depcheck` · `pnpm lint` (frontend)

No backend (`pnpm --filter @msimulation-xml/backend <script>`):

- `dev` · `build` · `test` · `lint` · `db:generate` · `db:migrate` · `db:migrate:deploy`
- Tipos dos testes: `exec tsc --noEmit -p tsconfig.test.json`

## 12. Situação atual

A conversão dos módulos vindos da migração Fastify → NestJS terminou (plano em `tasks/plan-marketplaces-feature-modules.md`). Todos os contextos (`auth`, `catalog`, `fiscal-documents`, `fiscal-settings`, `fiscal-validation`, `health`, `logistics`, `lookup`, `marketplace`, `org`, `remessas`, `sales`, `tax`) seguem este documento:

- pastas por feature dentro do contexto, sem `domain/`, `application/`, `infrastructure/`, `presentation/`;
- services, use cases e repositories `@Injectable` com `@Inject(Classe)` explícito, sem `create<Ctx>Module()` nem tokens de composition root;
- DTOs Zod em `<feature>/dtos/`;
- suíte inteira em Vitest (`*.spec.ts` em `test/`); não há mais `node:test` no backend.

O que ainda difere do contrato, de propósito:

| Contrato | Hoje | Por quê |
|---|---|---|
| Entidade com `create`/`restore` em `src/entities/` | Tipos da feature em `<feature>/types/` e mappers | Os agregados são linhas Prisma com regras fiscais em `rules/`; entidade nova entra quando houver comportamento a encapsular |
| `BusinessException` | Erros nomeados por contexto em `errors/`, mapeados por filtro de rota | Os status (400, 409, 422) fazem parte do contrato com o frontend |
| Lista paginada com `offset`/`limit` | Listas sem paginação nas rotas atuais | Contrato do frontend; paginar é mudança de API |

Regras que continuam:

1. Sem SWC e sem `emitDecoratorMetadata`: a injeção é sempre `@Inject(Classe ou TOKEN)`. Dev (`tsx`), testes (Vitest/oxc) e build (`tsc`) se comportam igual.
2. Validação em Zod (não `class-validator`): as mensagens do Zod fazem parte do contrato com o frontend.
3. `rules/` e `types/` não importam Nest nem Fastify (`src/test/architecture.spec.ts` e a regra `rules-no-nest-layer` do dependency-cruiser).
4. Nada de `if (marketplace === "...")`: regras por marketplace vêm do perfil em `packages/fiscal-core/src/marketplaces/`.
5. Migration só vale em produção depois de verificada num Postgres local (`backend/scripts/verify-marketplaces-migration.sh`).

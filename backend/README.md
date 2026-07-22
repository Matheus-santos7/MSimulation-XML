# Backend — MSimulation XML

API REST em **Fastify + TypeScript + Prisma + PostgreSQL** que sustenta o simulador fiscal de fulfillment (Mercado Livre Full).

> **Contexto do produto:** simulador educacional. XMLs usam homologação (`tpAmb=2`), assinaturas fictícias e **não têm validade** perante a SEFAZ.

---

## Índice

1. [Stack e execução local](#stack-e-execução-local)
2. [Visão geral da arquitetura](#visão-geral-da-arquitetura)
3. [Camadas (Clean Architecture)](#camadas-clean-architecture)
4. [Bounded contexts (`src/modules/`)](#bounded-contexts-srcmodules)
5. [Diagrama de arquitetura](#diagrama-de-arquitetura)
6. [Bootstrap e registo de rotas](#bootstrap-e-registo-de-rotas)
7. [Estrutura de pastas](#estrutura-de-pastas)
8. [Comunicação entre módulos](#comunicação-entre-módulos)
9. [Padrões e convenções](#padrões-e-convenções)
10. [Packages compartilhados](#packages-compartilhados)
11. [Fluxos de negócio](#fluxos-de-negócio)
12. [Fluxo HTTP](#fluxo-http)
13. [Validador MCP](#validador-mcp)
14. [Problemas comuns](#problemas-comuns)
15. [Testes e scripts](#testes-e-scripts)
16. [Documentação por módulo](#documentação-por-módulo)

---

## Stack e execução local

| Tecnologia | Uso |
|------------|-----|
| **Fastify 5** | Servidor HTTP, plugins, hooks |
| **TypeScript** | Tipagem estrita |
| **Zod** | Validação HTTP (presentation) |
| **Prisma 7** | ORM + migrations PostgreSQL |
| **@fastify/jwt** | Access / refresh tokens |
| **Brevo** | E-mails transacionais |
| **otplib** | 2FA TOTP |

```bash
# Na raiz do monorepo
pnpm install
cp .env.example .env
cp backend/.env.example backend/.env
pnpm db:setup
pnpm dev
```

| Serviço | URL |
|---------|-----|
| API | http://localhost:3001 |
| Health | http://localhost:3001/api/health |

Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `PASSWORD_PEPPER`, `CORS_ORIGINS`, `APP_PUBLIC_URL`. Ver [`backend/.env.example`](./.env.example).

---

## Visão geral da arquitetura

O backend é um **monolito modular** organizado por **Bounded Contexts** (DDD), cada um em `src/modules/<nome>/`. A organização interna segue **Clean Architecture** em quatro camadas concêntricas:

| Camada | Responsabilidade | Depende de |
|--------|------------------|------------|
| **Domain** | Entidades, erros, ports (contratos), regras puras | Nada externo |
| **Application** | Casos de uso, DTOs, orquestração | Domain |
| **Infrastructure** | Prisma, APIs externas, adapters, factories | Application + Domain |
| **Presentation** | Controllers Fastify, schemas Zod | Application (+ Infrastructure via factory) |

**Regra de ouro das dependências:** o domínio nunca importa Fastify, Prisma ou HTTP. Os controladores são *burros*: validam entrada, chamam um caso de uso e devolvem a resposta.

O wiring HTTP vive em `src/index.ts` e em `src/plugins/` — não em pastas `routes/` legadas (removidas na migração para módulos).

---

## Camadas (Clean Architecture)

Fluxo típico de uma requisição autenticada:

```
HTTP Request
    │
    ▼
plugins/ (JWT, RLS, rate-limit, guards)
    │
    ▼
presentation/controllers/   ← parse Zod, tenantId, status HTTP
    │
    ▼
application/use-cases/    ← um caso de uso = uma ação de negócio
    │
    ▼
domain/ports/             ← interface (contrato)
    │
    ▼
infrastructure/           ← Prisma repository, gateway HTTP, adapter
    │
    ▼
PostgreSQL (+ RLS por tenant)
```

Cada módulo expõe um **composition root** em `infrastructure/factory/*-module.factory.ts` que instancia repositórios e injeta nos casos de uso.

Código transversal (motor de impostos, geração de chaves NF-e, mappers, RLS) permanece em `src/lib/` — bibliotecas internas sem regra de negócio de um único contexto.

---

## Bounded contexts (`src/modules/`)

| Módulo | Responsabilidade de negócio |
|--------|----------------------------|
| [**auth**](./src/modules/auth/) | Autenticação (login, refresh, logout), registo, verificação de e-mail, reset de senha, 2FA TOTP e onboarding inicial (vínculo empresa + utilizador). |
| [**org**](./src/modules/org/) | Gestão de **tenants** (empresas emitentes) e **utilizadores** do tenant (CRUD, papéis ADMIN/MEMBER). |
| [**catalog**](./src/modules/catalog/) | Catálogo de **produtos** (SKU, NCM, preços, vínculo com regra fiscal `taxRuleBaseId`), importação em massa. |
| [**tax**](./src/modules/tax/) | **Regras tributárias** (catálogo, resolução origem×destino, cálculo de impostos para venda/remessa/inbound). |
| [**logistics**](./src/modules/logistics/) | **Unidades logísticas** Meli Full, movimentações de stock, avanço entre CDs e resolução de destino fiscal. |
| [**remessas**](./src/modules/remessas/) | Emissão de **NF-e de remessa** (física e simbólica), **FIFO** de saldo por `nfe_itens`, CT-e de remessa e avanço de mercadoria na cadeia fulfillment. |
| [**sales**](./src/modules/sales/) | **Pedidos** (rascunho, checkout, faturamento) e orquestração da **cadeia de venda** (retorno simbólico → venda → CT-e). |
| [**fiscal-documents**](./src/modules/fiscal-documents/) | Consulta e ciclo de vida de **NF-e** e **CT-e** (listagem, XML, soft-delete, cancelamento, devolução, inutilização), timeline e eventos fiscais. |
| [**fiscal-settings**](./src/modules/fiscal-settings/) | **Configurações do emissor** ML (séries, prazos, composição de base, CST de devolução, etc.). |
| [**lookup**](./src/modules/lookup/) | Consultas externas **CNPJ** (BrasilAPI / OpenCNPJ) e **CEP** (BrasilAPI / ViaCEP) para onboarding e cadastros. |
| [**health**](./src/modules/health/) | Endpoint `/api/health` (liveness + verificação de conexão à base de dados). |

---

## Diagrama de arquitetura

### Camadas e fluxo HTTP

```mermaid
graph TD
  Client[Cliente HTTP / Frontend]

  subgraph Bootstrap["Bootstrap (src/index.ts)"]
    IDX[index.ts]
    HP[healthController]
    AP[authController]
    AL[authenticatedLookupPlugin]
    PP[protectedApiPlugin]
  end

  subgraph Plugins["Plugins transversais"]
    JWT[authPlugin JWT]
    PRISMA[prismaPlugin]
    RLS[RLS + guards]
    RL[rate-limit]
  end

  subgraph Presentation["Presentation"]
    CTRL[Controllers Fastify]
    ZOD[Schemas Zod]
  end

  subgraph Application["Application"]
    UC[Use Cases]
    DTO[DTOs / Commands]
  end

  subgraph Domain["Domain"]
    ENT[Entities / VOs]
    PORT[Ports]
    ERR[Domain Errors]
  end

  subgraph Infrastructure["Infrastructure"]
    REPO[Prisma Repositories]
    GW[External Gateways]
    FACT[Module Factories]
  end

  subgraph Shared["Shared (src/lib/)"]
    TAX[tax-engine / chaves / mappers]
    DB[tenant-rls / prisma-tx]
  end

  DB_PG[(PostgreSQL)]

  Client --> IDX
  IDX --> HP
  IDX --> AP
  IDX --> AL
  IDX --> PP
  PP --> JWT
  PP --> PRISMA
  PP --> RLS
  PP --> RL
  PP --> CTRL
  CTRL --> ZOD
  CTRL --> UC
  UC --> PORT
  UC --> ENT
  FACT --> REPO
  FACT --> GW
  REPO -.->|implementa| PORT
  GW -.->|implementa| PORT
  REPO --> DB_PG
  UC --> TAX
  REPO --> DB
```

### Módulos e dependências de negócio

```mermaid
graph TD
  Auth[auth]
  Org[org]
  Lookup[lookup]
  Catalog[catalog]
  Tax[tax]
  Logistics[logistics]
  Remessas[remessas]
  Sales[sales]
  FiscalDocs[fiscal-documents]
  FiscalSettings[fiscal-settings]
  Health[health]

  Auth -->|onboarding| Org
  Auth --> Lookup
  Logistics --> Remessas
  Logistics --> Catalog
  Logistics --> Lookup
  Remessas --> Tax
  Remessas --> Logistics
  Remessas --> FiscalDocs
  Sales --> Tax
  Sales --> Remessas
  Sales --> FiscalDocs
  FiscalDocs --> Remessas
  FiscalDocs --> Tax
  Catalog --> Tax
  FiscalSettings --> Tax

  subgraph Fiscal["Domínio fiscal"]
    FiscalDocs
    FiscalSettings
    Sales
    Remessas
    Tax
  end

  subgraph Platform["Plataforma"]
    Auth
    Org
    Lookup
    Health
  end

  subgraph Operations["Operação ML"]
    Catalog
    Logistics
  end
```

---

## Bootstrap e registo de rotas

[`src/index.ts`](./src/index.ts) regista plugins nesta ordem:

| Escopo | Plugin / Controller | Autenticação |
|--------|---------------------|--------------|
| `/api/health` | `healthController` | Público |
| `/api/auth/*` | `authController` | Público / Bearer |
| `/api/lookup/*` | `lookupController` (via `authenticatedLookupPlugin`) | JWT, **sem** tenant |
| `/api/*` (negócio) | `protectedApiPlugin` → contextos | JWT + tenant + e-mail verificado |

Contextos protegidos ([`plugins/contexts/`](./src/plugins/contexts/)):

| Plugin | Controllers registados |
|--------|------------------------|
| `orgContextPlugin` | `tenantController`, `userController` |
| `catalogContextPlugin` | `productController` |
| `fiscalContextPlugin` | NF-e, CT-e, lifecycle, observabilidade, tax rules, emitter settings, pedidos |
| `logisticsContextPlugin` | unidades logísticas, movimentações |

Todos os controladores são importados diretamente de `modules/<ctx>/presentation/controllers/`.

---

## Estrutura de pastas

```
backend/
├── prisma/                    # Schema e migrations
├── src/
│   ├── index.ts               # Entrada Fastify
│   ├── modules/               # Bounded contexts (Clean Architecture)
│   │   └── <context>/
│   │       ├── domain/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       ├── presentation/
│   │       └── index.ts
│   ├── plugins/               # JWT, Prisma, API protegida, contextos
│   ├── lib/                   # Utilitários transversais (fiscal, db, http)
│   └── generated/prisma/      # Client gerado
└── package.json
```

Estrutura interna de cada módulo (obrigatória):

```
modules/<context>/
├── domain/
│   ├── entities/
│   ├── errors/
│   ├── ports/              # Interfaces de repositório / gateway
│   └── value-objects/      # Quando aplicável
├── application/
│   ├── use-cases/
│   ├── dto/
│   └── services/           # Orquestração pura sem I/O
├── infrastructure/
│   ├── prisma/
│   ├── external/           # APIs de terceiros
│   └── factory/            # Composition root
└── presentation/
    ├── controllers/
    └── schemas/
```

---

## Comunicação entre módulos

- **Preferência:** um módulo consome outro via **caso de uso público** ou função exportada no `index.ts` do módulo alvo — nunca importando Prisma de outro contexto diretamente no controller.
- **Adapters:** quando um contexto precisa de capacidade externa (ex.: logistics → lookup CEP), usa-se um adapter em `infrastructure/external/` que implementa um **port** do próprio módulo.
- **lib/fiscal:** motor de cálculo (`tax-engine`), snapshots e chaves são bibliotecas compartilhadas; a resolução de regras fica no módulo **tax**.
- **remessas** é o núcleo FIFO e emissão de remessa; **sales** e **fiscal-documents** delegam consumo/estorno de saldo a ele.
- Imports cross-module devem apontar para o `index.ts` do módulo alvo (ex.: `modules/remessas`), não para pastas legadas em `src/services/`.

---

## Padrões e convenções

| Tópico | Convenção |
|--------|-----------|
| Ficheiros / pastas | `kebab-case` |
| Casos de uso | `verb-noun.use-case.ts` + classe `PascalCase` |
| Controllers | `*-controller.ts`, plugin FastifyAsync |
| Erros de domínio | Classe com `.status` HTTP; mapear em `handleRouteError` |
| Validação HTTP | Zod em `presentation/schemas/` |
| IDs multi-tenant | Sempre filtrar por `tenantId` do JWT; RLS ativo em `protected-api` |
| Transações | Dentro de infrastructure (repositório), não no controller |

Pacotes internos do monorepo: `@msimulation-xml/fiscal-core`, `@msimulation-xml/nfe-xml` — detalhe na secção [Packages compartilhados](#packages-compartilhados).

---

## Packages compartilhados

Pacotes TypeScript puros (sem DB), consumidos pelo backend e testáveis isoladamente. Pastas na raiz do monorepo: [`../packages/fiscal-core`](../packages/fiscal-core/), [`../packages/nfe-xml`](../packages/nfe-xml/).

### `@msimulation-xml/fiscal-core`

| Responsabilidade | Exemplos |
| ---------------- | -------- |
| Assinatura XML simulada | `buildSimulationXmlSignature`, `injectSimulationSignature` |
| Enrichment payload ML | `enrichFiscalPayloadMlFulfillment`, `enrichFiscalPayloadMlVenda` |
| CT-e | `buildCteFiscalPayload`, `buildCTeXML` |
| Runtime do emissor | `buildEmitterSnapshot`, `calcTributoBase`, `resolveDifalMode` |
| ICMS interestadual | `resolveInterstateIcmsRateForProductOrigin` |

```bash
pnpm --filter @msimulation-xml/fiscal-core build
pnpm --filter @msimulation-xml/fiscal-core test
```

### `@msimulation-xml/nfe-xml`

| Responsabilidade | Exemplos |
| ---------------- | -------- |
| Montagem XML NF-e | `buildNFeXML`, `highlightXML` |
| Tags de imposto a partir do engine | `buildIcmsXmlFromEngineItem`, `icmsTotFromEngine` |
| Eventos | `buildProcEventoCancelamentoXML` |

Depende de `@msimulation-xml/fiscal-core`.

```bash
pnpm --filter @msimulation-xml/nfe-xml build
pnpm --filter @msimulation-xml/nfe-xml test
```

### Pipeline de geração de XML

```mermaid
flowchart LR
  subgraph Backend
    TE[tax-engine]
    RS[remessa-service]
    BUILD[buildNfeXmlAutorizado]
    VAL[resolveNfeValidationUpdate]
    PERSIST[persistNfeXmlAutorizado]
  end
  subgraph Packages
    FC[fiscal-core]
    NX[nfe-xml]
  end
  subgraph MCP["Validador MCP (opcional)"]
    PROXY[fiscal-validator-proxy]
  end
  RS --> TE
  TE --> FC
  FC --> NX
  NX --> BUILD
  BUILD --> VAL
  VAL --> PROXY
  PROXY --> VAL
  VAL --> PERSIST
  PERSIST --> DB[(nfe + xml + auditoria)]
```

---

## Fluxos de negócio

### Onboarding

```mermaid
flowchart TD
  A[Criar conta / Login] --> B{E-mail verificado?}
  B -->|Não| C[/login/verificar-email]
  B -->|Sim| D{Tenant cadastrado?}
  D -->|Não| E[/onboarding/empresa]
  E --> F[Consulta CNPJ via lookup]
  F --> G[Cria tenant + usuário ADMIN]
  G --> H[Dashboard]
  D -->|Sim| H
```

### Setup operacional (antes de emitir)

```mermaid
flowchart LR
  S1[Regras tributárias] --> S2[Produtos]
  S2 --> S3[Unidades logísticas CDs]
  S3 --> S4[Configurações fiscais]
  S4 --> S5[Pronto para operar]
```

### Remessa física (envio ao CD)

```mermaid
sequenceDiagram
  participant UI as Frontend /operacoes
  participant R as remessas
  participant L as logistics
  participant T as tax
  participant F as fiscal-documents
  participant P as packages
  UI->>R: POST remessa
  R->>L: resolve destino fiscal
  loop Por item
    R->>T: resolveTaxRule + calculateInvoiceTaxes
  end
  R->>P: enrich + buildNFeXML
  R->>F: persiste NF-e + FIFO + CT-e
  F-->>UI: NF-e + CT-e (simulado)
```

### Avanço CD → CD

```mermaid
flowchart TD
  A[Produto + CD origem + destino] --> B[Valida saldo FIFO]
  B --> C[Consome FIFO]
  C --> D[Nova NF-e REMESSA referenciando anterior]
  D --> E[Novo saldo no destino]
  E --> F[CT-e de remessa]
```

### Cadeia de venda

```mermaid
flowchart TD
  P1[Pedido rascunho] --> P2[Checkout FIFO]
  P2 --> P3[Faturar]
  P3 --> R1[Retorno simbólico NF-e]
  R1 --> R2[Venda NF-e]
  R2 --> R3[CT-e frete]
  R3 --> DONE[Pedido FATURADO]
```

### Dependências entre módulos

```mermaid
graph TD
  Auth[auth] --> Org[org]
  Auth --> Lookup[lookup]
  Logistics[logistics] --> Remessas[remessas]
  Logistics --> Catalog[catalog]
  Remessas --> Tax[tax]
  Remessas --> FiscalDocs[fiscal-documents]
  Sales[sales] --> Tax
  Sales --> Remessas
  Sales --> FiscalDocs
  Catalog --> Tax
  FiscalSettings[fiscal-settings] --> Tax
```

---

## Fluxo HTTP

```mermaid
sequenceDiagram
  participant B as Browser
  participant N as Next.js
  participant F as Fastify
  participant M as Use Case
  participant D as PostgreSQL
  B->>N: GET /produtos
  N->>N: layout valida sessão
  N->>F: GET /api/products
  F->>F: JWT + tenantId + RLS
  F->>M: ListProductsUseCase
  M->>D: SELECT … tenant_id
  D-->>M: rows
  M-->>F: DTOs
  F-->>N: 200 JSON
  N-->>B: HTML
```

Mutações usam Server Actions no frontend com POST/PUT/DELETE na API.

---

## Validador MCP

Auditoria de XML NF-e **após** geração e **antes** de persistir — **não bloqueante**. Escopo v1: só NF-e (CT-e fora). Pacote: [mcp-fiscal-brasil](https://github.com/dehor-labs/mcp-fiscal-brasil). Proxy: [`../infra/fiscal-validator-proxy`](../infra/fiscal-validator-proxy/).

### Comportamento

| Cenário | `statusValidacao` | Emissão abortada? |
| ------- | ----------------- | ----------------- |
| XML aprovado | `APPROVED` | Não |
| XML rejeitado | `REJECTED` | **Não** — só rastreio |
| `FISCAL_VALIDATOR_ENABLED=false` | `PENDING` | Não |
| MCP offline / timeout | `PENDING` | Não |

Choke point: `src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.ts` via `persistNfeXmlAutorizado`.

### Env (placeholders — ver [`.env.example`](./.env.example))

| Variável | Default dev | Descrição |
| -------- | ----------- | --------- |
| `FISCAL_VALIDATOR_URL` | `http://localhost:8080` | Base do proxy |
| `FISCAL_VALIDATOR_ENABLED` | `true` | `false` / `0` pula MCP |

Raiz do monorepo: `FISCAL_VALIDATOR_PORT` em [`../.env.example`](../.env.example).

### Docker local

```bash
# Na raiz do monorepo
pnpm docker:up
curl -sf http://localhost:8080/health
```

Imagem: [`../Dockerfile.fiscal-validator`](../Dockerfile.fiscal-validator). Deploy: [`../render.yaml`](../render.yaml).

### API de observabilidade

| Método | Rota | Auth |
| ------ | ---- | ---- |
| `GET` | `/api/fiscal-validation/status` | JWT + tenant |
| `GET` | `/api/fiscal-validation/insights` | JWT + tenant |
| `POST` | `/api/fiscal-validation/backfill` | JWT + tenant + ADMIN |

O browser **nunca** chama o MCP — só o backend.

### Arquitetura (resumo)

```mermaid
flowchart TB
  UC[Use cases emissão] --> PERSIST[persistNfeXmlAutorizado]
  PERSIST --> BUILD[buildNfeXmlAutorizado]
  BUILD --> RESOLVE[resolveNfeValidationUpdate]
  RESOLVE --> HTTP[HttpFiscalValidatorAdapter]
  HTTP -->|POST /api/v1/validate-nfe| PROXY[FastAPI :8080]
  PROXY --> MCP[mcp-fiscal-brasil]
  RESOLVE --> DB[(nfes + auditoria)]
```

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
| ------- | -------------- | ------- |
| `ECONNREFUSED :5432` | Postgres parado | `pnpm docker:up` (raiz) |
| API 401 em tudo | JWT / `JWT_SECRET` mudou | Relogar; confira `.env` |
| Migration falha | Banco desatualizado | `pnpm --filter @msimulation-xml/backend exec prisma migrate deploy` |
| Build falha em packages | `dist/` velho | `pnpm --filter @msimulation-xml/fiscal-core build && pnpm --filter @msimulation-xml/nfe-xml build` |
| CORS no browser | Origem não listada | `CORS_ORIGINS=http://localhost:3000` |
| NF-es sempre `PENDING` | MCP offline | `pnpm docker:up` ou `FISCAL_VALIDATOR_ENABLED=false` |
| Badge rejeitado | XML reprovado (esperado) | Detalhe NF-e → painel de auditoria |

---

## Testes e scripts

```bash
# Testes unitários (compila pacotes fiscais antes)
pnpm --filter @msimulation-xml/backend test

# Typecheck
pnpm --filter @msimulation-xml/backend exec tsc --noEmit

# Prisma
pnpm --filter @msimulation-xml/backend exec prisma migrate dev
pnpm --filter @msimulation-xml/backend exec prisma studio
```

---

## Documentação por módulo

Cada bounded context deve ter o seu `README.md` com overview, diagrama de sequência do caso de uso principal e lista de entidades (regra **02-backend-documentation**). **Índice previsto** (ficheiros ainda não criados na maioria dos módulos):

| Módulo | Pasta alvo |
|--------|------------|
| auth | `src/modules/auth/README.md` |
| org | `src/modules/org/README.md` |
| catalog | `src/modules/catalog/README.md` |
| tax | `src/modules/tax/README.md` |
| logistics | `src/modules/logistics/README.md` |
| remessas | `src/modules/remessas/README.md` |
| sales | `src/modules/sales/README.md` |
| fiscal-documents | `src/modules/fiscal-documents/README.md` (há nota em `infrastructure/observability/`) |
| fiscal-settings | `src/modules/fiscal-settings/README.md` |
| lookup | `src/modules/lookup/README.md` |
| health | `src/modules/health/README.md` |

Documentação complementar:

| Documento | Conteúdo |
| --------- | -------- |
| [`../README.md`](../README.md) | Portal do monorepo |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Como contribuir |
| [`docs/fiscal/regras-fulfillment-cat31.md`](./docs/fiscal/regras-fulfillment-cat31.md) | Portaria CAT 31 / ML Full |
| [`docs/fiscal/manual-nfe-moc.md`](./docs/fiscal/manual-nfe-moc.md) | Referência estrutural NF-e (MOC) |
| [`../frontend/README.md`](../frontend/README.md) | Thin client Next.js |

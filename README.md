# MSimulation XML

Simulador fiscal educacional para operações de **fulfillment Mercado Livre Full** — NF-e, CT-e, remessas, vendas e impostos.

Monorepo · pnpm workspaces · `@msimulation-xml/backend` · `@msimulation-xml/frontend` · `@msimulation-xml/fiscal-core` · `@msimulation-xml/nfe-xml`

---

## Índice

1. [O que é este projeto?](#o-que-é-este-projeto)
2. [Para quem é este README?](#para-quem-é-este-readme)
3. [Conceitos básicos (leia antes de codar)](#conceitos-básicos-leia-antes-de-codar)
4. [Visão geral do monorepo](#visão-geral-do-monorepo)
5. [Stack tecnológica](#stack-tecnológica)
6. [Como rodar localmente](#como-rodar-localmente)
7. [Backend (API)](#backend-api)
8. [Frontend (interface)](#frontend-interface)
9. [Packages compartilhados](#packages-compartilhados)
10. [Fluxos de negócio (diagramas)](#fluxos-de-negócio-diagramas)
11. [Fluxo de uma requisição HTTP](#fluxo-de-uma-requisição-http)
12. [Mapa de arquivos importantes](#mapa-de-arquivos-importantes)
13. [Multi-tenant, auth e segurança](#multi-tenant-auth-e-segurança)
14. [Testes e qualidade](#testes-e-qualidade)
15. [Guia do estagiário: por onde começar](#guia-do-estagiário-por-onde-começar)
16. [Scripts úteis](#scripts-úteis)
17. [Validador MCP Fiscal Brasil](#validador-mcp-fiscal-brasil)
18. [Documentação complementar](#documentação-complementar)
19. [Problemas comuns](#problemas-comuns)

---

## O que é este projeto?

**MSimulation XML** é uma aplicação web que simula o ciclo fiscal de um seller no **Mercado Livre Full** (fulfillment):


| Etapa operacional | O que o sistema faz                                                       |
| ----------------- | ------------------------------------------------------------------------- |
| Cadastro          | Empresa (tenant), produtos, regras tributárias, unidades logísticas (CDs) |
| Remessa           | NF-e de envio de mercadoria ao centro de distribuição ML                  |
| Avanço            | Movimentação entre CDs (nova remessa referenciando saldo FIFO)            |
| Venda             | Pedido → retorno simbólico → NF-e de venda → CT-e de frete                |
| Consulta          | Listagem de NF-e/CT-e, download de XML, cancelamento, devolução           |


> **Aviso importante:** este é um **simulador educacional**. Os XMLs usam ambiente de homologação (`tpAmb=2`), assinaturas fictícias e **não têm validade jurídica** perante a SEFAZ. Nunca use estes documentos em produção real.

---

## Para quem é este README?

Este guia foi escrito para quem  já conhece, em nível básico:

- **JavaScript/TypeScript** — variáveis, async/await, imports
- **React** — componentes, props, hooks básicos
- **Next.js** — ideia de rotas e páginas (App Router)
- **Node.js** — servidor HTTP, variáveis de ambiente
- **SQL/ORM** — tabelas, relações, migrations (conceito de Prisma)
- **REST API** — GET/POST, JSON, status HTTP, JWT

Se algum termo acima for novo, anote e pesquise antes de mergulhar no código fiscal — a curva de aprendizado aqui mistura **programação web** com **regras tributárias brasileiras**.

---

## Conceitos básicos (leia antes de codar)


| Termo                 | Significado no projeto                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| **Tenant**            | Empresa emitente cadastrada no sistema (multi-empresa). Cada tenant tem seus produtos, notas e usuários. |
| **NF-e**              | Nota Fiscal Eletrônica de produto. Tipos: `REMESSA`, `VENDA`, `RETORNO_SIMBOLICO`, etc.                  |
| **CT-e**              | Conhecimento de Transporte Eletrônico (frete vinculado à remessa ou venda).                              |
| **Remessa física**    | Envio de estoque do seller para um CD do Mercado Livre.                                                  |
| **Remessa simbólica** | Operação fiscal sem movimentação física (ex.: retorno simbólico antes da venda).                         |
| **FIFO**              | Controle de saldo por item de NF-e (`nfe_itens`) — consumo na ordem de entrada.                          |
| **Regra tributária**  | Configuração de ICMS, PIS, COFINS, IPI por origem × destino × produto.                                   |
| **Unidade logística** | CD Meli Full cadastrado (código, UF, `idCadIntTran`).                                                    |
| **BFF**               | Backend-for-Frontend — rota Next.js que repassa chamadas autenticadas para a API.                        |
| **Use Case**          | Uma ação de negócio isolada (ex.: `EmitirRemessaInicialUseCase`).                                        |
| **Bounded Context**   | Módulo de domínio com responsabilidade clara (ex.: `remessas`, `sales`, `tax`).                          |


---

## Visão geral do monorepo

O repositório é um **monorepo** gerenciado com **pnpm workspaces**. Tudo vive na mesma árvore de pastas, mas cada pacote tem seu `package.json` e pode ser executado separadamente.

```
msedit-xml/                          ← você está aqui (raiz)
├── backend/                         ← API REST (Fastify + Prisma)
├── frontend/                        ← Interface web (Next.js 15)
├── packages/
│   ├── fiscal-core/                 ← Utilitários fiscais puros (sem DB)
│   └── nfe-xml/                     ← Geração de XML NF-e/CT-e
├── docs/assets/                     ← Logo e assets de documentação
├── docker-compose.yml               ← PostgreSQL + validador MCP (opcional)
├── Dockerfile.fiscal-validator      ← Imagem do proxy MCP para Render/Docker
├── infra/fiscal-validator-proxy/    ← FastAPI + auditoria CAT 31 (Python)
├── pnpm-workspace.yaml              ← Declara os workspaces
├── package.json                     ← Scripts globais (dev, build, test)
└── README.md                        ← este arquivo
```

### Diagrama: como os pacotes se relacionam

```mermaid
graph TB
  subgraph UI["Frontend — porta 3000"]
    NEXT[Next.js App Router]
    BFF["/api/bff/* proxy"]
    SA[Server Actions]
  end

  subgraph API["Backend — porta 3001"]
    FAST[Fastify]
    MOD[modules/*]
    PRISMA[Prisma ORM]
  end

  subgraph PKG["Packages compartilhados"]
    FC[fiscal-core]
    NX[nfe-xml]
  end

  DB[(PostgreSQL)]

  NEXT --> SA
  NEXT --> BFF
  SA --> FAST
  BFF --> FAST
  FAST --> MOD
  MOD --> PRISMA
  MOD --> FC
  MOD --> NX
  NX --> FC
  PRISMA --> DB
```



---

## Stack tecnológica


| Camada          | Tecnologias                                                                | Para que serve                               |
| --------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| **Monorepo**    | pnpm 9, concurrently                                                       | Instalar deps e subir front + back juntos    |
| **Backend**     | Fastify 5, TypeScript, Zod, Prisma 7, PostgreSQL                           | API REST, regras de negócio, persistência    |
| **Frontend**    | Next.js 15, React 19, Tailwind v4, shadcn/ui, React Hook Form + Zod        | Interface do cockpit fiscal                  |
| **Auth**        | JWT (access + refresh), 2FA TOTP, Brevo (e-mail)                           | Login, sessão, reset de senha                |
| **Packages**    | TypeScript puro                                                            | Lógica fiscal reutilizável e testável        |
| **Infra local** | Docker Compose (Postgres 16 + validador MCP opcional)                      | Banco e auditoria fiscal de XML              |
| **Validador**   | `mcp-fiscal-brasil` 0.4.0 + proxy FastAPI (`infra/fiscal-validator-proxy`) | Auditoria estrutural e regras CAT 31 de NF-e |


---

## Como rodar localmente

### Pré-requisitos

- **Node.js** 20+ (recomendado LTS)
- **pnpm** 9 (`corepack enable && corepack prepare pnpm@9.15.9 --activate`)
- **Docker** (para PostgreSQL local)

### Passo a passo

```bash
# 1. Clonar e instalar dependências
git clone <url-do-repo>
cd msedit-xml
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env                    # Docker (POSTGRES_*)
cp backend/.env.example backend/.env    # API (JWT, DATABASE_URL, etc.)
cp frontend/.env.example frontend/.env.local   # opcional (API_URL)

# 3. Subir banco e aplicar migrations
pnpm db:setup

# 4. Subir frontend + backend
pnpm dev
```


| Serviço       | URL                                                                                |
| ------------- | ---------------------------------------------------------------------------------- |
| Frontend      | [http://localhost:3000](http://localhost:3000)                                     |
| Backend (API) | [http://localhost:3001](http://localhost:3001)                                     |
| Health check  | [http://localhost:3001/api/health](http://localhost:3001/api/health)               |
| Validador MCP | [http://localhost:8080/health](http://localhost:8080/health) (se `pnpm docker:up`) |
| Prisma Studio | `pnpm --filter @msimulation-xml/backend exec prisma studio`                        |


### Variáveis obrigatórias (backend)

Consulte `[backend/.env.example](backend/.env.example)`. Mínimo para dev local:


| Variável          | Exemplo                                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`    | `postgresql://msimulation:msimulation@localhost:5432/msimulation_xml?schema=public` |
| `JWT_SECRET`      | string longa e aleatória (≥ 16 chars)                                               |
| `PASSWORD_PEPPER` | outra string longa, diferente do JWT                                                |
| `CORS_ORIGINS`    | `http://localhost:3000`                                                             |
| `APP_PUBLIC_URL`  | `http://localhost:3000`                                                             |


Sem `BREVO_API_KEY`, links de reset de senha aparecem no **console da API** (comportamento esperado em dev).

---

## Backend (API)

Documentação detalhada: `[backend/README.md](backend/README.md)`

### O que é

Servidor **Fastify** que expõe a API REST `/api/`*. Toda regra de negócio fiscal, cálculo de impostos, geração de XML e acesso ao banco vive aqui — **nunca no frontend**.

### Arquitetura: Clean Architecture + DDD

Cada domínio fica em `backend/src/modules/<nome>/` com quatro camadas:

```
modules/<context>/
├── domain/           ← entidades, erros, ports (interfaces) — SEM Fastify/Prisma
├── application/      ← use cases (casos de uso) — orquestra o domínio
├── infrastructure/   ← Prisma, APIs externas, factories
└── presentation/     ← controllers Fastify + schemas Zod
```

**Regra de ouro:** `domain` não importa nada externo. Controllers são *burros*: validam entrada, chamam use case, devolvem resposta.

### Módulos (bounded contexts)


| Módulo               | Pasta                       | Responsabilidade                                      |
| -------------------- | --------------------------- | ----------------------------------------------------- |
| **auth**             | `modules/auth/`             | Login, registro, JWT, 2FA, reset de senha, onboarding |
| **org**              | `modules/org/`              | Tenants (empresas) e usuários (ADMIN/MEMBER)          |
| **catalog**          | `modules/catalog/`          | Produtos (SKU, NCM, preço, importação XLSX)           |
| **tax**              | `modules/tax/`              | Regras tributárias e motor de cálculo de impostos     |
| **logistics**        | `modules/logistics/`        | Unidades logísticas ML, movimentações de estoque      |
| **remessas**         | `modules/remessas/`         | Emissão de NF-e de remessa, FIFO, avanço de CD        |
| **sales**            | `modules/sales/`            | Pedidos, checkout, faturamento, cadeia de venda       |
| **fiscal-documents** | `modules/fiscal-documents/` | NF-e/CT-e: consulta, XML, cancelamento, devolução     |
| **fiscal-settings**  | `modules/fiscal-settings/`  | Configurações do emissor ML (séries, DIFAL, CST…)     |
| **lookup**           | `modules/lookup/`           | Consulta CNPJ e CEP (via BrasilAPI/ViaCEP)            |
| **health**           | `modules/health/`           | `/api/health`                                         |


### Diagrama: camadas de uma requisição no backend

```mermaid
flowchart TD
  REQ[HTTP Request] --> PLG[plugins/ — JWT, RLS, rate-limit]
  PLG --> CTRL[presentation/controllers]
  CTRL --> ZOD[Validação Zod]
  CTRL --> UC[application/use-cases]
  UC --> PORT[domain/ports]
  PORT --> REPO[infrastructure/prisma]
  REPO --> PG[(PostgreSQL)]
  UC --> LIB[src/lib/ — tax-engine, chaves NF-e]
  UC --> PKG[@msimulation-xml/fiscal-core]
  UC --> XML[@msimulation-xml/nfe-xml]
```



### Bootstrap (`backend/src/index.ts`)

Ordem de registro das rotas:


| Escopo          | Autenticação                     |
| --------------- | -------------------------------- |
| `/api/health`   | Público                          |
| `/api/auth/*`   | Público / Bearer                 |
| `/api/lookup/*` | JWT (sem tenant — onboarding)    |
| `/api/*` demais | JWT + tenant + e-mail verificado |


---

## Frontend (interface)

Documentação resumida: `[frontend/README.md](frontend/README.md)`

### O que é

Aplicação **Next.js 15** (App Router) que funciona como **camada de apresentação fina** (*thin client*). O frontend:

- Renderiza telas e formulários
- Valida formato básico na UI (Zod)
- Envia dados para a API via **Server Actions** ou **BFF proxy**
- **Não** calcula impostos, **não** gera XML, **não** parseia planilhas fiscalmente

### Estrutura de rotas (`frontend/src/app/`)

```
src/app/
├── (auth)/login/              ← login, 2FA, reset de senha, verificar e-mail
├── (onboarding)/onboarding/   ← cadastro inicial da empresa
├── (app)/                     ← área logada (AppShell + sidebar)
│   ├── page.tsx               ← dashboard
│   ├── produtos/              ← catálogo
│   ├── regras/                ← regras tributárias
│   ├── operacoes/             ← remessas, transferências, avanço
│   ├── pedidos/               ← pedidos e faturamento
│   ├── nfe/ e cte/            ← consulta de documentos fiscais
│   ├── unidades-logisticas/   ← CDs Meli
│   ├── empresas/              ← tenant e filiais
│   ├── usuarios/              ← gestão de usuários
│   ├── configuracoes-fiscais/ ← settings do emissor ML
│   └── auditoria/             ← logs de auditoria
└── api/bff/[...path]/         ← proxy autenticado para downloads/XML
```

### Diagrama: organização do frontend

```mermaid
graph TB
  subgraph Pages["Páginas (app/)"]
    P1[page.tsx — Server Component]
    P2[actions.ts — Server Actions]
  end

  subgraph Lib["Bibliotecas (src/lib/)"]
    FA[fiscal-api.ts — chamadas à API]
    AUTH[auth/ — sessão, cookies, login]
    FORM[*-form.ts — schemas Zod de UI]
    HTTP[bff-proxy.ts — proxy server-side]
  end

  subgraph UI["Componentes (src/components/)"]
    SH[ui/ — shadcn]
    FIS[fiscal-ui, forms de domínio]
  end

  P1 --> FA
  P1 --> UI
  P2 --> FA
  FA --> API[Backend :3001]
  HTTP --> API
  AUTH --> API
```



### Padrões importantes no frontend


| Padrão                    | Onde                           | Por quê                                              |
| ------------------------- | ------------------------------ | ---------------------------------------------------- |
| **Server Components**     | `page.tsx`                     | Buscar dados no servidor, sem expor token no browser |
| **Server Actions**        | `actions.ts` ao lado da página | Mutações (POST/PUT/DELETE) com validação Zod         |
| **React Hook Form + Zod** | Formulários complexos          | Validação de UI antes de enviar à API                |
| **BFF proxy**             | `api/bff/[...path]/route.ts`   | Download de XML/arquivos com token server-side       |
| **Erros da API**          | `user-facing-error.ts`         | Traduz erros de domínio para mensagens amigáveis     |


### Fluxo típico: salvar um produto

```mermaid
sequenceDiagram
  participant U as Usuário
  participant F as ProductForm (React)
  participant SA as Server Action
  participant API as Backend /api/products
  participant DB as PostgreSQL

  U->>F: Preenche SKU, NCM, preço
  F->>F: Validação Zod (UI)
  F->>SA: submit(formData)
  SA->>SA: Validação Zod (server)
  SA->>API: POST + Bearer JWT
  API->>API: Use Case CreateProduct
  API->>DB: INSERT product
  DB-->>API: produto criado
  API-->>SA: 201 JSON
  SA-->>F: redirect / revalidate
  F-->>U: toast de sucesso
```



---

## Packages compartilhados

Pacotes TypeScript puros, **sem banco de dados**, usados pelo backend (e testáveis isoladamente).

### `@msimulation-xml/fiscal-core`

**Pasta:** `packages/fiscal-core/`


| Responsabilidade             | Exemplos de export                                               |
| ---------------------------- | ---------------------------------------------------------------- |
| Assinatura XML simulada      | `buildSimulationXmlSignature`, `injectSimulationSignature`       |
| Enriquecimento de payload ML | `enrichFiscalPayloadMlFulfillment`, `enrichFiscalPayloadMlVenda` |
| CT-e (template e XML)        | `buildCteFiscalPayload`, `buildCTeXML`                           |
| Runtime do emissor           | `buildEmitterSnapshot`, `calcTributoBase`, `resolveDifalMode`    |
| ICMS interestadual           | `resolveInterstateIcmsRateForProductOrigin`                      |
| Preços de produto            | `productUnitPrice`, `lineTotal`                                  |


**Por que existe?** Separar lógica fiscal pura (testável, sem I/O) da orquestração com Prisma no backend.

```bash
pnpm --filter @msimulation-xml/fiscal-core build
pnpm --filter @msimulation-xml/fiscal-core test
```

### `@msimulation-xml/nfe-xml`

**Pasta:** `packages/nfe-xml/`


| Responsabilidade                   | Exemplos de export                                |
| ---------------------------------- | ------------------------------------------------- |
| Montagem do XML NF-e               | `buildNFeXML`, `highlightXML`                     |
| Tags de imposto a partir do engine | `buildIcmsXmlFromEngineItem`, `icmsTotFromEngine` |
| Eventos fiscais                    | `buildProcEventoCancelamentoXML`                  |
| Tipos suportados                   | `NFE_XML_PERSIST_SUPPORTED` (fase REMESSA)        |


**Dependência:** importa `@msimulation-xml/fiscal-core`.

```bash
pnpm --filter @msimulation-xml/nfe-xml build
pnpm --filter @msimulation-xml/nfe-xml test
```

### Diagrama: pipeline de geração de XML

```mermaid
flowchart LR
  subgraph Backend
    TE[tax-engine — cálculo por item]
    RS[remessa-service — orquestração]
    BUILD[buildNfeXmlAutorizado]
    VAL[resolveNfeValidationUpdate]
    PERSIST[persistNfeXmlAutorizado]
  end

  subgraph Packages
    FC[fiscal-core — enrich payload ML]
    NX[nfe-xml — buildNFeXML]
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

## Fluxos de negócio (diagramas)

### 1. Onboarding e primeiro acesso

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



### 2. Setup operacional (antes de emitir notas)

```mermaid
flowchart LR
  S1[Importar regras tributárias] --> S2[Cadastrar Produtos]
  S2 --> S3[Cadastrar unidades logísticas CDs]
  S3 --> S4[Configurações fiscais do emissor]
  S4 --> S5[Pronto para operar]
```



### 3. Remessa física (envio ao CD)

Fluxo simplificado do que acontece quando o usuário emite uma remessa em **Operações → Remessa inicial**:

```mermaid
sequenceDiagram
  participant UI as Frontend /operacoes
  participant R as remessas module
  participant L as logistics module
  participant T as tax module
  participant F as fiscal-documents
  participant P as packages

  UI->>R: POST remessa (produtos + CD destino)
  R->>L: resolve destino fiscal (UF, idCadIntTran)
  loop Por item
    R->>T: resolveTaxRule + calculateInvoiceTaxes
  end
  R->>P: enrichFiscalPayloadMlFulfillment
  R->>P: buildNFeXML
  R->>F: persiste NF-e + itens + saldo FIFO
  R->>F: emite CT-e de remessa
  F-->>UI: NF-e + CT-e autorizados (simulado)
```



### 4. Avanço de mercadoria (CD → CD)

```mermaid
flowchart TD
  A[Seleciona produto + CD origem + CD destino] --> B[Valida saldo FIFO no CD origem]
  B --> C[Consome saldo FIFO parcial ou total]
  C --> D[Emite nova NF-e REMESSA referenciando nota anterior]
  D --> E[Cria novo saldo FIFO no destino]
  E --> F[Emite CT-e de remessa]
```



### 5. Cadeia de venda (pedido → faturamento)

```mermaid
flowchart TD
  P1[Criar pedido rascunho] --> P2[Checkout — valida estoque FIFO]
  P2 --> P3[Faturar pedido]
  P3 --> R1[Retorno simbólico — NF-e]
  R1 --> R2[Venda — NF-e]
  R2 --> R3[CT-e de venda frete]
  R3 --> DONE[Pedido FATURADO]
```



### 6. Dependências entre módulos do backend

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

## Fluxo de uma requisição HTTP

Visão unificada front → back → DB:

```mermaid
sequenceDiagram
  participant B as Browser
  participant N as Next.js
  participant F as Fastify
  participant M as Module Use Case
  participant D as PostgreSQL

  B->>N: Acessa /produtos
  N->>N: layout.tsx valida sessão (JWT cookie)
  N->>F: GET /api/products (Server Component)
  F->>F: JWT + tenantId + RLS
  F->>M: ListProductsUseCase
  M->>D: SELECT products WHERE tenant_id = ?
  D-->>M: rows
  M-->>F: ProductDto[]
  F-->>N: 200 JSON
  N-->>B: HTML renderizado

  Note over B,D: Mutações usam Server Actions com POST/PUT/DELETE
```



---

## Mapa de arquivos importantes

### Raiz


| Arquivo               | Função                                     |
| --------------------- | ------------------------------------------ |
| `package.json`        | Scripts `dev`, `build`, `test`, `db:setup` |
| `pnpm-workspace.yaml` | Lista `backend`, `frontend`, `packages/*`  |
| `docker-compose.yml`  | Postgres local                             |
| `.env.example`        | Credenciais do container Postgres          |


### Backend — arquivos que você vai abrir com frequência


| Arquivo                                                                 | Função                                     |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| `backend/src/index.ts`                                                  | Entrada do servidor, registro de plugins   |
| `backend/src/plugins/protected-api.ts`                                  | Rotas autenticadas + RLS                   |
| `backend/prisma/schema.prisma`                                          | Modelo de dados (tenants, products, nfes…) |
| `backend/src/modules/tax/domain/services/tax-engine.ts`                 | Motor de cálculo de impostos               |
| `backend/src/modules/remessas/infrastructure/fiscal/remessa-service.ts` | Orquestração da NF-e de remessa            |
| `backend/src/modules/sales/infrastructure/fiscal/`                      | Cadeia de venda                            |
| `backend/src/lib/http/error-handler.ts`                                 | Mapeamento de erros de domínio → HTTP      |


### Frontend — arquivos que você vai abrir com frequência


| Arquivo                                       | Função                           |
| --------------------------------------------- | -------------------------------- |
| `frontend/src/app/(app)/layout.tsx`           | Guard de auth + onboarding       |
| `frontend/src/lib/fiscal-api.ts`              | Todas as chamadas GET/POST à API |
| `frontend/src/lib/auth/session.ts`            | Token, cookies, `getAuthMe()`    |
| `frontend/src/components/app-shell.tsx`       | Layout sidebar + navegação       |
| `frontend/src/app/api/bff/[...path]/route.ts` | Proxy para download de XML       |
| `frontend/src/lib/user-facing-error.ts`       | Mensagens de erro amigáveis      |


### Packages


| Arquivo                                          | Função                          |
| ------------------------------------------------ | ------------------------------- |
| `packages/fiscal-core/src/index.ts`              | Exports públicos do fiscal-core |
| `packages/fiscal-core/src/remessa-ml-payload.ts` | Payload ML para remessa         |
| `packages/fiscal-core/src/cte-template.ts`       | Montagem do CT-e                |
| `packages/nfe-xml/src/nfe-xml-generator.ts`      | Gerador do XML NF-e             |
| `packages/nfe-xml/src/fiscal-engine-xml.ts`      | Tags ICMS/IPI/PIS do engine     |


---

## Multi-tenant, auth e segurança

### Multi-tenant

- Cada **tenant** (empresa) tem dados isolados por `tenant_id`.
- O JWT carrega `tenantId` após o onboarding.
- **Row Level Security (RLS)** no PostgreSQL reforça isolamento nas rotas protegidas.

### Autenticação


| Token   | Duração padrão | Uso                            |
| ------- | -------------- | ------------------------------ |
| Access  | 30 min         | Header `Authorization: Bearer` |
| Refresh | 7 dias         | Renova access token            |


Fluxo de login: credenciais → (2FA se ativo) → cookies httpOnly no frontend → Server Components leem sessão server-side.

### O que o frontend **não** deve fazer

- Chamar APIs externas (ViaCEP, SEFAZ, Mercado Livre) direto do browser
- Importar `xlsx` para processar planilhas fiscais
- Montar ou assinar XML de NF-e/CT-e
- Implementar regras de deduplicação de SKU ou cálculo de DIFAL

Tudo isso pertence ao **backend**.

---

## Testes e qualidade

```bash
# Todos os testes do backend + packages fiscais
pnpm test:backend

# Apenas packages
pnpm test:fiscal-core
pnpm test:nfe-xml

# Typecheck backend
pnpm --filter @msimulation-xml/backend exec tsc --noEmit

# Lint frontend
pnpm lint

# Formatar código
pnpm format
```

Os testes fiscais mais críticos ficam em:

- `backend/src/modules/tax/domain/services/tax-engine.test.ts`
- `backend/src/modules/remessas/infrastructure/fifo/remessa-fifo.test.ts`
- `packages/fiscal-core/src/*.test.ts`
- `packages/nfe-xml/src/*.test.ts`

---

## Guia  por onde começar

Sugestão de ordem de leitura/exploração (1–2 semanas):


| Semana | Foco                   | Ações                                                                                                                          |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **1**  | Ambiente + arquitetura | Rodar `pnpm dev`, criar conta, explorar UI. Ler este README e `backend/README.md`. Abrir Prisma Studio e ver tabelas.          |
| **1**  | Frontend básico        | Seguir fluxo: `produtos/page.tsx` → `actions.ts` → `fiscal-api.ts` → controller no backend.                                    |
| **2**  | Backend básico         | Escolher um CRUD simples (`catalog` ou `org`). Mapear controller → use case → repository.                                      |
| **2**  | Fiscal introdutório    | Ler `backend/docs/fiscal/regras-fulfillment-cat31.md`. Emitir uma remessa pela UI e rastrear no código (`remessa-service.ts`). |
| **3+** | Domínio escolhido      | Aprofundar em `tax`, `remessas` ou `sales` conforme tarefa do time.                                                            |


### Checklist antes do primeiro PR

- [ ] Projeto sobe local sem erros (`pnpm db:setup && pnpm dev`)
- [ ] Entendo a diferença entre `domain`, `application`, `infrastructure`, `presentation`
- [ ] Sei onde ficam validações de UI vs validações de domínio
- [ ] Li o aviso: simulador, não produção SEFAZ
- [ ] Não coloquei lógica fiscal no frontend

---

## Scripts úteis


| Comando             | Descrição                               |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Sobe backend (:3001) + frontend (:3000) |
| `pnpm dev:backend`  | Só API                                  |
| `pnpm dev:frontend` | Só Next.js                              |
| `pnpm build`        | Build packages + frontend + backend     |
| `pnpm db:setup`     | Docker up + migrations                  |
| `pnpm docker:up`    | Sobe Postgres                           |
| `pnpm docker:down`  | Para Postgres + validador MCP           |
| `pnpm docker:reset` | Apaga volume do banco (cuidado!)        |
| `pnpm test:backend` | Testes fiscais + backend                |


---

## Validador MCP Fiscal Brasil

O simulador integra o pacote **[mcp-fiscal-brasil](https://github.com/dehor-labs/mcp-fiscal-brasil)** para auditar o XML de NF-e **depois** de gerado e **antes** de persistir na transação de emissão. O objetivo é **rastreabilidade e diagnóstico** — a emissão **não é bloqueada** quando o XML é rejeitado ou quando o validador está offline.

> **Escopo v1:** apenas NF-e. CT-e fica fora. Validação fiscal pesada roda no backend; o frontend só exibe status e erros retornados pela API.

### O que o validador faz

O proxy Python (`infra/fiscal-validator-proxy/`) orquestra o MCP e regras do simulador (fulfillment ML / Portaria CAT 31):


| Etapa                | Responsável                                   | Exemplos de checagem                            |
| -------------------- | --------------------------------------------- | ----------------------------------------------- |
| Parse e estrutura    | `mcp-fiscal-brasil`                           | XML bem formado, tags NF-e v4.00                |
| Chave e assinatura   | `validar_chave_nfe`, `validar_assinatura_nfe` | 44 dígitos, digest (simulado)                   |
| Regras de negócio    | `audit.py`                                    | CFOP 5949/6949, CST ICMS, `infIntermed`, totais |
| Resposta consolidada | `POST /api/v1/validate-nfe`                   | `valida`, `resumo`, `erros[]`, `achados[]`      |


### Arquitetura (visão geral)

```mermaid
flowchart TB
  subgraph Emissao["Backend — emissão de NF-e"]
    UC[Use cases de remessa / venda / devolução]
    BUILD[buildNfeXmlAutorizado]
    PERSIST[persistNfeXmlAutorizado]
    RESOLVE[resolveNfeValidationUpdate]
    UC --> PERSIST
    PERSIST --> BUILD
    BUILD --> XML[String XML]
    XML --> RESOLVE
  end

  subgraph Adapter["Camada de integração"]
    CFG[loadFiscalValidatorConfig]
    FACT[getFiscalValidator]
    HTTP[HttpFiscalValidatorAdapter]
    RESOLVE --> CFG
    RESOLVE --> FACT
    FACT --> HTTP
  end

  subgraph Validator["Microsserviço MCP"]
    PROXY[FastAPI proxy :8080]
    AUDIT[audit_nfe_xml]
    MCP[mcp-fiscal-brasil 0.4.0]
    HTTP -->|POST /api/v1/validate-nfe| PROXY
    PROXY --> AUDIT
    AUDIT --> MCP
  end

  subgraph Persist["PostgreSQL — nfes"]
    COLS[status_validacao · mensagem_validacao · erros_validacao · auditoria_mcp · xml_autorizado]
    RESOLVE --> COLS
  end

  subgraph UI["Frontend (thin client)"]
    LIST[Lista NF-e — badge]
    DET[Detalhe NF-e — painel de auditoria]
    IA[Página IA Insights]
    COLS --> LIST
    COLS --> DET
    COLS --> IA
  end
```



### Fluxo na emissão (ponto único de integração)

Todas as emissões que persistem XML passam por `persistNfeXmlAutorizado` — remessa física, venda, devolução, transferência, etc. Não há validação duplicada em cada use case.

```mermaid
sequenceDiagram
  participant TX as Transação Prisma
  participant SVC as nfe-xml-service
  participant NX as nfe-xml builder
  participant VAL as resolveNfeValidationUpdate
  participant MCP as Validador MCP
  participant DB as nfes

  TX->>SVC: persistNfeXmlAutorizado(nfeId, ...)
  SVC->>NX: buildNfeXmlAutorizado(...)
  NX-->>SVC: xml (string)
  SVC->>VAL: validate + map status
  alt FISCAL_VALIDATOR_ENABLED=true e MCP online
    VAL->>MCP: POST /api/v1/validate-nfe { xml }
    MCP-->>VAL: { valida, resumo, erros, achados }
    VAL-->>SVC: APPROVED ou REJECTED + auditoriaMcp
  else Validador desabilitado
    VAL-->>SVC: PENDING — "Validação desabilitada"
  else MCP offline / timeout
    VAL-->>SVC: PENDING — "Validador indisponível: …"
  end
  SVC->>DB: UPDATE xml_autorizado + campos de validação
  Note over TX,DB: Emissão continua — validação não aborta a transação
```



### Regras de comportamento


| Cenário                          | `statusValidacao`             | Emissão abortada?         |
| -------------------------------- | ----------------------------- | ------------------------- |
| XML aprovado (`valida: true`)    | `APPROVED`                    | Não                       |
| XML rejeitado (`valida: false`)  | `REJECTED` + `errosValidacao` | **Não** — apenas rastreio |
| `FISCAL_VALIDATOR_ENABLED=false` | `PENDING`                     | Não                       |
| MCP indisponível (HTTP/timeout)  | `PENDING`                     | Não                       |


Implementação: `backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.ts`.

### Configuração

#### Variáveis de ambiente (backend)


| Variável                    | Default dev             | Descrição                                              |
| --------------------------- | ----------------------- | ------------------------------------------------------ |
| `FISCAL_VALIDATOR_URL`      | `http://localhost:8080` | Base URL do proxy (aceita URL completa ou `host:port`) |
| `FISCAL_VALIDATOR_HOSTPORT` | —                       | Alternativa ao URL (ex.: host interno Render)          |
| `FISCAL_VALIDATOR_ENABLED`  | `true`                  | `false` ou `0` pula a chamada ao MCP                   |


Raiz (Docker): `FISCAL_VALIDATOR_PORT=8080` mapeia host → container `:8000`.

Consulte também `backend/.env.example` e `.env.example`.

#### Docker Compose (desenvolvimento local)

O serviço `fiscal-validator-api` sobe com `pnpm docker:up` (junto com Postgres):

```yaml
# docker-compose.yml (resumo)
fiscal-validator-api:
  build:
    dockerfile: Dockerfile.fiscal-validator
  ports:
    - "${FISCAL_VALIDATOR_PORT:-8080}:8000"
```

Smoke test:

```bash
pnpm docker:up
curl -sf http://localhost:8080/health
curl -sf -X POST http://localhost:8080/api/v1/validate-nfe \
  -H 'Content-Type: application/json' \
  -d '{"xml":"<nfeProc/>"}'
```

Para desenvolver **sem** Docker do validador, use `FISCAL_VALIDATOR_ENABLED=false` no `backend/.env`.

#### Produção (Render)

O blueprint `render.yaml` declara dois web services:

1. `**msimulation-xml-fiscal-validator`** — imagem `Dockerfile.fiscal-validator`, health em `/health`
2. `**msimulation-xml-api**` — recebe `FISCAL_VALIDATOR_URL` via `fromService` (hostport privado do validador)

O proxy existe porque o `mcp-fiscal-brasil` 0.4.0 expõe nativamente `POST /v1/nfe/validate` com `**xml_path` em disco**; o proxy traduz `POST /api/v1/validate-nfe` com `**{ "xml": "..." }` inline**, compatível com o backend Node.

Arquivos principais:


| Arquivo                                 | Função                                            |
| --------------------------------------- | ------------------------------------------------- |
| `Dockerfile.fiscal-validator`           | Imagem Python 3.12 + `mcp-fiscal-brasil==0.4.0`   |
| `infra/fiscal-validator-proxy/main.py`  | FastAPI — `/health`, `/api/v1/validate-nfe`       |
| `infra/fiscal-validator-proxy/audit.py` | Auditoria consolidada (CAT 31, CFOP remessa, CST) |
| `render.yaml`                           | Deploy API + validador no Render                  |


### Backend — código e persistência


| Camada           | Arquivo                                                                      | Responsabilidade                   |
| ---------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| Port             | `backend/src/modules/fiscal-documents/domain/ports/fiscal-validator.port.ts` | Contrato `validateNfe(xml)`        |
| Adapter HTTP     | `.../infrastructure/external/http-fiscal-validator.adapter.ts`               | Cliente REST do proxy              |
| Config / factory | `backend/src/lib/fiscal-validator-config.ts`, `fiscal-validator-factory.ts`  | Env + singleton                    |
| Integração       | `.../infrastructure/xml/nfe-xml-service.ts`                                  | Choke point na persistência do XML |
| Status           | `backend/src/lib/fiscal-validator-status.ts`                                 | Probe `GET /health`                |
| Backfill         | `.../infrastructure/xml/nfe-validation-backfill.service.ts`                  | Revalida NF-es `PENDING`           |
| Insights         | `.../application/use-cases/get-validation-insights.use-case.ts`              | Agregados para IA                  |


Campos Prisma em `NFe` (`backend/prisma/schema.prisma`):

- `statusValidacao` — `PENDING` | `APPROVED` | `REJECTED`
- `mensagemValidacao` — resumo legível
- `errosValidacao` — JSON com lista de strings
- `auditoriaMcp` — payload completo (`valida`, `resumo`, `erros`, `achados`)

### API REST exposta pelo backend


| Método | Rota                              | Auth                     | Descrição                                 |
| ------ | --------------------------------- | ------------------------ | ----------------------------------------- |
| `GET`  | `/api/fiscal-validation/status`   | JWT + tenant             | MCP habilitado? alcançável?               |
| `GET`  | `/api/fiscal-validation/insights` | JWT + tenant             | Contadores, top erros, rejeições (7 dias) |
| `POST` | `/api/fiscal-validation/backfill` | JWT + tenant + **ADMIN** | Revalida lote de NF-es `PENDING`          |


Controller: `backend/src/modules/fiscal-documents/presentation/controllers/fiscal-observability.controller.ts`.

### Frontend — como a UI consome

O browser **nunca** chama o MCP diretamente. Tudo passa pelo backend (`/api/fiscal-validation/`* e campos em `NFeDto`).

```mermaid
flowchart LR
  subgraph Pages
    NFE_LIST[/nfe — lista]
    NFE_DET[/nfe/chave — detalhe]
    IA[/ia — insights]
  end

  subgraph Components
    BADGE[nfe-validation-badge]
    PANEL[nfe-validation-audit-panel]
    INSIGHTS[fiscal-validation-insights]
    BANNER[fiscal-validator-status-banner]
    BACKFILL[fiscal-validation-backfill-button]
  end

  subgraph API
    BFF[Server Components / fiscal-api]
    BE[Backend Fastify]
  end

  NFE_LIST --> BADGE
  NFE_DET --> PANEL
  IA --> INSIGHTS
  IA --> BANNER
  IA --> BACKFILL
  BADGE --> BFF
  PANEL --> BFF
  INSIGHTS --> BFF
  BANNER --> BFF
  BACKFILL --> BFF
  BFF --> BE
```




| Componente                              | Onde            | Dados exibidos                            |
| --------------------------------------- | --------------- | ----------------------------------------- |
| `nfe-validation-badge.tsx`              | Lista de NF-e   | Badge `PENDING` / `APPROVED` / `REJECTED` |
| `nfe-validation-audit-panel.tsx`        | Detalhe da NF-e | `validationAudit` — achados MCP completos |
| `fiscal-validation-insights.tsx`        | `/ia`           | Métricas e rejeições recentes             |
| `fiscal-validator-status-banner.tsx`    | `/ia` (admin)   | Alerta se MCP offline                     |
| `fiscal-validation-backfill-button.tsx` | `/ia` (admin)   | Dispara backfill de pendentes             |


Cliente API: `frontend/src/lib/fiscal-api/validation-insights.ts`.

### Backfill de NF-es pendentes

NF-es emitidas enquanto o validador estava offline ficam com `statusValidacao = PENDING`. Admins podem reprocessar em lote (até 200 por chamada) via botão na página **IA Insights** ou `POST /api/fiscal-validation/backfill`.

O backfill regenera o XML se necessário (`resolveNfeXmlStringFromLoadedRow`), reenvia ao MCP e atualiza os quatro campos de auditoria.

### Documentação de design


| Documento                                                               | Conteúdo                                  |
| ----------------------------------------------------------------------- | ----------------------------------------- |
| `docs/fiscal/mcp-nfe-validation-flow.md`                                | Fluxo envio/devolutiva MCP + mapeamento   |
| `docs/superpowers/specs/2026-06-22-fiscal-validation-module-design.md` | Módulo DDD `fiscal-validation` (pass-through) |
| `docs/superpowers/specs/2026-06-20-mcp-fiscal-xml-validation-design.md` | Spec funcional v1 (status: concluída)        |
| `docs/superpowers/plans/2026-06-20-mcp-fiscal-xml-validation.md`        | Plano de implementação e mapa de arquivos |


---

## Documentação complementar


| Documento                                                                                                                                        | Conteúdo                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `[backend/README.md](backend/README.md)`                                                                                                         | Arquitetura detalhada do backend, módulos, convenções |
| `[frontend/README.md](frontend/README.md)`                                                                                                       | Rotas, marca, execução do frontend                    |
| `[backend/docs/fiscal/regras-fulfillment-cat31.md](backend/docs/fiscal/regras-fulfillment-cat31.md)`                                             | Regras ML Full / Portaria CAT 31                      |
| `[backend/docs/fiscal/manual-nfe-moc.md](backend/docs/fiscal/manual-nfe-moc.md)`                                                                 | Referência estrutural NF-e (MOC)                      |
| `[backend/.env.example](backend/.env.example)`                                                                                                   | Variáveis da API (incl. `FISCAL_VALIDATOR_`*)         |
| `[frontend/.env.example](frontend/.env.example)`                                                                                                 | Variáveis do Next.js                                  |
| `[docs/superpowers/specs/2026-06-20-mcp-fiscal-xml-validation-design.md](docs/superpowers/specs/2026-06-20-mcp-fiscal-xml-validation-design.md)` | Design do validador MCP Fiscal Brasil                 |


---

## Problemas comuns


| Sintoma                    | Causa provável                        | Solução                                                                                                  |
| -------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ECONNREFUSED :5432`       | Postgres não está rodando             | `pnpm docker:up`                                                                                         |
| API retorna 401 em tudo    | JWT expirado ou `JWT_SECRET` mudou    | Logout, login de novo; confira `backend/.env`                                                            |
| Frontend não alcança API   | `API_URL` errada                      | Confira `frontend/.env.local` → `http://127.0.0.1:3001`                                                  |
| Migration falha            | Banco desatualizado                   | `pnpm --filter @msimulation-xml/backend exec prisma migrate deploy`                                      |
| Build falha em packages    | `dist/` desatualizado                 | `pnpm --filter @msimulation-xml/fiscal-core build && pnpm --filter @msimulation-xml/nfe-xml build`       |
| CORS error no browser      | Origem não listada                    | Adicione `http://localhost:3000` em `CORS_ORIGINS`                                                       |
| NF-es sempre `PENDING`     | Validador MCP offline ou desabilitado | `pnpm docker:up`; confira `FISCAL_VALIDATOR_URL` e `/health`; ou `FISCAL_VALIDATOR_ENABLED=false` em dev |
| Badge rejeitado na UI      | XML reprovado pelo MCP (esperado)     | Abra detalhe da NF-e → painel de auditoria; corrija regra/XML no backend                                 |
| Backfill não processa nada | Validador ainda indisponível          | Suba `fiscal-validator-api`; admin → página IA → botão de revalidação                                    |


---

MSimulation XML — simulador educacional · não substitui assessoria fiscal ou contábil
# Backend — MSimulation XML

API REST em **Fastify + TypeScript + Prisma + PostgreSQL** que sustenta o simulador fiscal de fulfillment (Mercado Livre Full). Este documento explica a arquitetura, o fluxo de requisições e o dia a dia de desenvolvimento para quem está entrando no projeto.

> **Contexto do produto:** simulador educacional. XMLs usam homologação (`tpAmb=2`), assinaturas fictícias e **não têm validade** perante a SEFAZ. O backend persiste documentos, calcula impostos e gera XML — sem transmissão real.

---

## Índice

1. [Stack e dependências](#stack-e-dependências)
2. [Como rodar localmente](#como-rodar-localmente)
3. [Arquitetura em camadas](#arquitetura-em-camadas)
4. [Estrutura de pastas](#estrutura-de-pastas)
5. [Ciclo de vida de uma requisição](#ciclo-de-vida-de-uma-requisição)
6. [Autenticação e autorização](#autenticação-e-autorização)
7. [Multi-tenant e Row-Level Security](#multi-tenant-e-row-level-security)
8. [Banco de dados (Prisma)](#banco-de-dados-prisma)
9. [Domínio fiscal — conceitos essenciais](#domínio-fiscal--conceitos-essenciais)
10. [Mapa de rotas HTTP](#mapa-de-rotas-http)
11. [Mapa de services](#mapa-de-services)
12. [Pacotes do monorepo](#pacotes-do-monorepo)
13. [Padrões de código](#padrões-de-código)
14. [Como implementar uma funcionalidade nova](#como-implementar-uma-funcionalidade-nova)
15. [Como investigar e corrigir bugs](#como-investigar-e-corrigir-bugs)
16. [Testes](#testes)
17. [Scripts úteis](#scripts-úteis)
18. [Referências](#referências)

---

## Stack e dependências

| Tecnologia | Uso |
|------------|-----|
| **Fastify 5** | Servidor HTTP, plugins, hooks |
| **TypeScript** | Tipagem estrita (`strict: true`) |
| **Zod** | Validação de body/params/query nas rotas |
| **Prisma 7** | ORM + migrations PostgreSQL |
| **@fastify/jwt** | Access tokens |
| **@fastify/rate-limit** | Limite de requisições |
| **Resend** | E-mails (reset de senha, verificação) |
| **otplib** | 2FA TOTP |
| **xlsx** | Importação de planilhas (produtos, regras, CDs) |

**Pacotes internos** (workspace pnpm):

- `@msimulation-xml/fiscal-core` — tipos fiscais, `xTexto`, preços por tipo de NF-e
- `@msimulation-xml/nfe-xml` — geração de XML NF-e layout 4.00

O frontend (**Next.js**) consome esta API via HTTP. **Não importe código de `frontend/`** no backend.

---

## Como rodar localmente

### Pré-requisitos

- Node.js **20+**
- pnpm **9+**
- Docker (PostgreSQL)

### Passo a passo

```bash
# Na raiz do monorepo
pnpm install

# Variáveis de ambiente
cp .env.example .env                    # Docker Postgres
cp backend/.env.example backend/.env    # API

# Gere segredos (valores distintos):
# openssl rand -base64 32

# Sobe Postgres + aplica migrations
pnpm db:setup

# API (:3001) + frontend (:3000)
pnpm dev
```

| Serviço | URL |
|---------|-----|
| API | http://localhost:3001 |
| Health check | http://localhost:3001/api/health |
| Prisma Studio | `pnpm --filter @msimulation-xml/backend exec prisma studio` |

### Primeiro acesso

1. Acesse http://localhost:3000/login e crie uma conta.
2. Confirme o e-mail (link no inbox ou **log do terminal da API** se `RESEND_API_KEY` estiver vazio).
3. Cadastre a empresa no onboarding (`POST /api/auth/onboarding/tenant`).
4. Importe regras tributárias e produtos antes de emitir documentos.

### Variáveis obrigatórias (`backend/.env`)

```env
DATABASE_URL=postgresql://msimulation:msimulation@localhost:5432/msimulation_xml?schema=public
JWT_SECRET=                    # mín. 16 (dev) / 32 (prod)
PASSWORD_PEPPER=               # distinto do JWT_SECRET
CORS_ORIGINS=http://localhost:3000
APP_PUBLIC_URL=http://localhost:3000
```

Referência completa: [`.env.example`](./.env.example).

---

## Arquitetura em camadas

O backend segue **monolito modular** com separação clara de responsabilidades:

```
HTTP Request
    │
    ▼
Routes (src/routes/)          ← Valida Zod, extrai tenantId do JWT, chama service
    │
    ▼
Services (src/services/)      ← Regras de negócio, transações Prisma
    │
    ├── lib/ (src/lib/)       ← Funções puras: tax-engine, chaves, mappers
    └── packages/             ← fiscal-core, nfe-xml (geração XML)
    │
    ▼
Prisma → PostgreSQL (+ RLS)
```

**Regra de ouro:** handlers de rota **nunca** contêm lógica de negócio. Se você está escrevendo `$transaction`, cálculo fiscal ou FIFO numa rota, mova para um service.

---

## Estrutura de pastas

```
backend/
├── prisma/
│   ├── schema.prisma          # Modelos, enums, relações
│   └── migrations/            # Histórico SQL versionado
├── src/
│   ├── index.ts               # Bootstrap Fastify — ponto de entrada
│   ├── generated/prisma/      # Client gerado (não editar manualmente)
│   │
│   ├── plugins/               # Extensões Fastify
│   │   ├── auth/              # JWT + hook authenticate
│   │   ├── prisma.ts          # Injeta fastify.prisma
│   │   ├── protected-api.ts   # Rotas autenticadas + RLS
│   │   ├── authenticated-lookup.ts  # CNPJ/CEP (JWT, sem tenant)
│   │   └── contexts/          # Agrupamento por domínio
│   │       ├── org.plugin.ts       → tenants, users
│   │       ├── catalog.plugin.ts   → products
│   │       ├── fiscal.plugin.ts    → nfes, pedidos, settings
│   │       ├── logistics.plugin.ts → unidades logísticas
│   │       └── guards.ts           → requireTenant, requireAdmin
│   │
│   ├── routes/                # Handlers HTTP (finos), por domínio
│   │   ├── auth/index.ts
│   │   ├── health/index.ts
│   │   ├── lookup/index.ts
│   │   ├── org/               # tenants.routes.ts, users.routes.ts
│   │   ├── catalog/           # products.routes.ts
│   │   ├── fiscal/            # nfes, ctes, tax-rules, pedidos, …
│   │   └── logistics/         # unidades, movimentacoes
│   │
│   ├── schemas/               # Schemas Zod por contexto
│   │   ├── auth/
│   │   ├── catalog/
│   │   ├── org/
│   │   ├── fiscal/
│   │   ├── orders/
│   │   └── logistics/
│   │
│   ├── services/              # Lógica de negócio, espelhando routes/
│   │   ├── auth/              # Login, 2FA, reset, verificação e-mail
│   │   ├── catalog/           # product-service
│   │   ├── org/               # tenant-service, user-service
│   │   ├── lookup/            # lookup-service (CNPJ/CEP)
│   │   ├── logistics/         # CDs, movimentações, avanço entre CDs
│   │   └── fiscal/            # emissão, FIFO, pedidos, XML, regras
│   │       └── venda-chain/   # Submódulo: retorno + venda + CT-e
│   │
│   ├── lib/                   # Utilitários puros, por domínio (espelha services/)
│   │   ├── auth/              # JWT, senha, TOTP, request-context
│   │   ├── db/                # Prisma singleton, RLS, transações
│   │   ├── http/              # CORS, helmet, error-handler, domain-errors
│   │   ├── org/               # tenant-mapper, user-mapper
│   │   ├── catalog/           # product-mapper
│   │   ├── lookup/            # rate-limit de CNPJ/CEP
│   │   ├── logistics/         # CDs Meli, planilha de importação
│   │   ├── fiscal/            # tax-engine, chaves NF-e/CT-e, mappers fiscais
│   │   └── shared/            # utilitários transversais (ex.: upload planilha)
│   │
│   ├── emails/                # Templates de e-mail (auth)
│   └── types/                 # Augmentação de tipos Fastify
│
├── prisma.config.ts           # Config Prisma 7 (datasource, migrations)
├── package.json
└── tsconfig.json
```

**Convenção:** cada domínio em `routes/` tem pasta homônima em `services/`, `schemas/` (quando há validação) e `lib/` (mappers, helpers e engine). Arquivos de rota usam sufixo `*.routes.ts`; services usam `*-service.ts`. Cada pasta exporta um `index.ts` agregador.

---

## Ciclo de vida de uma requisição

O arquivo [`src/index.ts`](./src/index.ts) registra plugins nesta ordem:

```
helmet → cors → prisma → auth
    │
    ├── /api/health          (público)
    ├── /api/auth/*          (público ou Bearer parcial)
    ├── /api/lookup/*        (JWT, sem exigir tenant — onboarding)
    └── protected-api        (JWT + tenant + e-mail verificado)
            ├── org          → /tenants, /users
            ├── catalog      → /products
            ├── fiscal       → /nfes, /pedidos, /fiscal-settings, ...
            └── logistics    → /unidades-logisticas, /movimentacoes/*
```

Fluxo dentro de `protected-api`:

1. **`app.authenticate`** — valida JWT, recarrega `tenantId`, `role` e `emailVerified` do banco.
2. **`applyRlsContext`** — define `app.tenant_id` no PostgreSQL para políticas RLS.
3. **`requireTenantHook`** — bloqueia se usuário ainda não cadastrou empresa.
4. **`requireEmailVerifiedHook`** — bloqueia se `REQUIRE_EMAIL_VERIFICATION=true`.
5. Handler da rota → service → resposta JSON.

Erros globais são tratados em [`src/lib/http/error-handler.ts`](./src/lib/http/error-handler.ts) (`ZodError` → 400, Prisma P2002 → 409, etc.). Rotas usam [`handleRouteError`](./src/lib/http/domain-errors.ts) para erros de domínio com `.status` HTTP.

---

## Autenticação e autorização

### Tokens

| Token | TTL padrão | Uso |
|-------|------------|-----|
| Access | 30 min | Header `Authorization: Bearer <token>` |
| Refresh | 7 dias | Body `{ refreshToken }` em `/api/auth/refresh` |
| 2FA pending | 5 min | Login intermediário antes do TOTP |

O access token carrega `userId`, `tokenVersion`, `typ: "access"`. O `tenantId` e `role` são **sempre relidos do banco** no hook `authenticate` — não confie só no payload JWT desatualizado.

### Papéis (RBAC)

| Papel | Permissões |
|-------|------------|
| **ADMIN** | Exclusão em massa de regras, gestão de usuários, importação de CDs |
| **MEMBER** | Operações fiscais do dia a dia |

Use `requireAdminHook` nas rotas sensíveis (ex.: `DELETE /tax-rules`).

### Rotas de auth (resumo)

| Método | Caminho | Descrição |
|--------|---------|-----------|
| POST | `/api/auth/register` | Cadastro (+ Turnstile em prod) |
| POST | `/api/auth/login` | Sessão ou desafio 2FA |
| POST | `/api/auth/login/verify-2fa` | Conclui login TOTP |
| POST | `/api/auth/refresh` | Renova access token |
| POST | `/api/auth/logout` | Revoga sessão |
| GET | `/api/auth/me` | Perfil do usuário |
| POST | `/api/auth/onboarding/tenant` | Cadastra empresa (vira ADMIN) |
| POST | `/api/auth/forgot-password` | Envia e-mail de reset |
| POST | `/api/auth/reset-password` | Redefine senha |
| POST | `/api/auth/verify-email` | Confirma e-mail |
| GET/POST | `/api/auth/2fa/*` | Configuração TOTP |

Código principal: [`src/routes/auth/index.ts`](./src/routes/auth/index.ts) + [`src/services/auth/`](./src/services/auth/).

---

## Multi-tenant e Row-Level Security

Cada empresa é um **`Tenant`**. Dados de negócio (produtos, NF-es, pedidos…) têm coluna `tenant_id`.

### Regras importantes

1. **`tenantId` vem exclusivamente do JWT** — nunca aceite `tenantId` do body ou query string em rotas protegidas.
2. Use `tenantIdFromRequest(req)` de [`src/lib/auth/request-context.ts`](./src/lib/auth/request-context.ts).
3. O PostgreSQL aplica **RLS** (Row-Level Security) via variáveis de sessão `app.tenant_id` e `app.user_id`, configuradas em [`src/lib/db/tenant-rls.ts`](./src/lib/db/tenant-rls.ts).

Se uma query retorna dados de outro tenant, verifique se a rota passa pelo `protected-api` e se o RLS está aplicado na migration correspondente.

---

## Banco de dados (Prisma)

### Convenções

- Modelos em **PascalCase** (`NFe`, `TenantUnidadeLogistica`).
- Colunas no banco em **snake_case** via `@map()` / `@@map()`.
- Chaves primárias: **UUID** (`@default(uuid())`).
- Índices em FKs, especialmente `tenant_id`.

### Modelos principais

| Modelo | Descrição |
|--------|-----------|
| `Tenant` | Emitente (CNPJ, endereço, séries) |
| `User` | Autenticação; `tenantId` nulo até onboarding |
| `Product` | SKU, NCM, preço venda/custo, `taxRuleBaseId` |
| `TaxRule` | Alíquotas origem×destino (importadas por planilha) |
| `Pedido` | Rascunho ML → faturamento dispara cadeia de venda |
| `NFe` | Documento fiscal simulado (tipos: REMESSA, VENDA, …) |
| `NfeItem` | Linhas da NF-e + saldo FIFO por item |
| `NfeRemessaConsumo` | Vínculo retorno ↔ remessa consumida |
| `CTe` | Conhecimento de transporte (remessa ou venda) |
| `MeliUnidadeLogistica` | CDs Mercado Livre Full (catálogo global) |
| `FiscalEmitterSettings` | JSON com config do emissor (DIFAL, frete, CST…) |

### Migrations

```bash
# Criar migration (dev)
pnpm --filter @msimulation-xml/backend db:migrate

# Aplicar em CI/produção
pnpm --filter @msimulation-xml/backend db:migrate:deploy

# Regenerar client após mudar schema
pnpm --filter @msimulation-xml/backend db:generate
```

O client Prisma é gerado em `src/generated/prisma/` (não em `node_modules`).

### Transações

Operações que criam vários registros (ex.: retorno + venda + CT-e) usam `prisma.$transaction`. Dentro da callback, o parâmetro `tx` tem tipo `PrismaTx` ([`src/lib/db/prisma-tx.ts`](./src/lib/db/prisma-tx.ts)).

---

## Domínio fiscal — conceitos essenciais

### Fluxo fulfillment (venda simples)

```
REMESSA (física, sem refNFe — raiz da cadeia)
    ↑ nfeReferenciaId
RETORNO_SIMBOLICO (consome saldo FIFO da remessa)
    ↑ nfeReferenciaId
VENDA (refNFe → retorno)
CT-e venda (referencia chave da NF-e de venda)
```

### Tipos de NF-e (`NFeTipo`)

| Tipo | Direção | Preço usado | Tem refNFe? |
|------|---------|-------------|-------------|
| `REMESSA` | Saída | `precoCusto` | Não |
| `RETORNO_SIMBOLICO` | Entrada | Custo / inbound | Sim → remessa |
| `VENDA` | Saída | `preco` | Sim → retorno |
| `DEVOLUCAO` | Entrada | Espelha venda | Sim → venda |
| `REMESSA_SIMBOLICA` | Saída | `precoCusto` | Sim → devolução |

### FIFO de remessa

O saldo fica em **`nfe_itens.saldo_disponivel`**, não mais só na NF-e pai. Ao faturar um pedido, [`remessa-fifo.ts`](./src/services/fiscal/remessa-fifo.ts) consome as remessas **mais antigas primeiro** e registra em `nfe_remessa_consumos`.

Erro comum: `SaldoRemessaInsuficienteError` — falta remessa física ou quantidade maior que o saldo.

### Engine tributária

[`src/lib/fiscal/tax-engine.ts`](./src/lib/fiscal/tax-engine.ts):

- ICMS **por dentro** por item.
- `<ICMSTot>` = soma dos itens (evita rejeição 532/533).
- Alíquotas vêm de `TaxRule` via [`tax-rule-service.ts`](./src/services/fiscal/tax-rule-service.ts) + [`tax-calculation-service.ts`](./src/services/fiscal/tax-calculation-service.ts).

### XML persistido

Cada emissão grava `xmlAutorizado` na NF-e via [`nfe-xml-service.ts`](./src/services/fiscal/nfe-xml-service.ts), usando `@msimulation-xml/nfe-xml`.

---

## Mapa de rotas HTTP

Todas as rotas de negócio têm prefixo **`/api`** e exigem JWT (salvo auth e health).

### Organização (`org`)

| Método | Caminho | Service |
|--------|---------|---------|
| GET/POST | `/tenants` | `tenant-service` |
| DELETE | `/tenants/:id` | `tenant-service` |
| GET/PATCH/DELETE | `/users` | `user-service` |

### Catálogo (`catalog`)

| Método | Caminho | Service |
|--------|---------|---------|
| GET/POST/PATCH/DELETE | `/products`, `/products/:id` | `product-service` |
| POST | `/products/bulk-upsert` | `product-service` |
| POST | `/products/:id/remessa` | `remessa-service` |

### Fiscal (`fiscal`)

| Método | Caminho | Service |
|--------|---------|---------|
| GET | `/nfes`, `/nfes/:chave` | Prisma + mappers |
| GET | `/nfes/:chave/xml` | `nfe-xml-service` |
| DELETE | `/nfes/:chave` | `fiscal-service` |
| POST | `/nfes/:chave/devolucao` | `devolucao-service` |
| POST | `/nfes/:chave/cancelamento` | `cancelamento-service` |
| POST | `/nfes/inutilizar` | `inutilizacao-service` |
| GET/DELETE | `/ctes`, `/ctes/:chave` | Prisma / `fiscal-service` |
| GET | `/timeline` | `timeline-service` |
| GET/POST/DELETE | `/tax-rules/*` | `tax-rule-catalog-service` |
| GET/PUT | `/fiscal-settings` | `fiscal-emitter-settings-service` |
| GET/POST/PATCH/DELETE | `/pedidos/*` | `pedido-service` |
| POST | `/pedidos/:id/faturar` | `pedido-service` → `venda-chain` |
| POST | `/pedidos/checkout` | `checkout-service` |
| GET | `/emitente`, `/audit-logs`, `/fiscal-events` | Prisma |

### Logística (`logistics`)

| Método | Caminho | Service |
|--------|---------|---------|
| GET/POST | `/unidades-logisticas/*` | `unidade-logistica-service` |
| POST | `/movimentacoes/avanco-cd` | `avanco-cd-service` |
| GET | `/movimentacoes-produto` | `movimentacao-produto-service` |

### Lookup (JWT, sem tenant)

| Método | Caminho | Service |
|--------|---------|---------|
| GET | `/lookup/cnpj/:cnpj` | `lookup-service` |
| GET | `/lookup/cep/:cep` | `lookup-service` |

Documentação inline detalhada: [`src/routes/fiscal/documents.routes.ts`](./src/routes/fiscal/documents.routes.ts) e sub-arquivos (`nfes.routes.ts`, `ctes.routes.ts`, …).

---

## Mapa de services

Services seguem a mesma organização por domínio que `routes/`:

### `services/auth/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `auth-service.ts` | Login, registro, refresh, onboarding |
| `two-factor-service.ts` | TOTP 2FA |
| `password-reset-service.ts` | Fluxo de reset de senha |
| `email-verification-service.ts` | Confirmação de e-mail |
| `email-service.ts` | Envio via Resend |

### `services/org/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `tenant-service.ts` | CRUD de empresas (tenants) |
| `user-service.ts` | Gestão de usuários do tenant |

### `services/catalog/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `product-service.ts` | Produtos, bulk upsert, vínculo com regras |

### `services/lookup/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `lookup-service.ts` | Consulta CNPJ (BrasilAPI) e CEP |

### `services/logistics/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `unidade-logistica-service.ts` | CDs Meli Full por tenant |
| `movimentacao-produto-service.ts` | Histórico de movimentações |
| `avanco-cd-service.ts` | Movimentação entre CDs + remessa |

### `services/fiscal/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `remessa-service.ts` | NF-e remessa física + CT-e remessa + saldo inicial |
| `remessa-fifo.ts` | Consumo/estorno FIFO por `nfe_itens` |
| `venda-chain/` + `venda-chain-service.ts` | Orquestra retorno → venda → CT-e venda |
| `devolucao-service.ts` | Devolução + estorno FIFO + remessa simbólica |
| `cancelamento-service.ts` | Evento 110111; cancela venda e retorno |
| `inutilizacao-service.ts` | Faixa de numeração inutilizada |
| `cte-remessa-service.ts` | CT-e vinculado à remessa |
| `cte-venda-service.ts` | CT-e vinculado à venda |
| `pedido-service.ts` | Rascunho + faturamento |
| `checkout-service.ts` | Checkout direto (sem rascunho) |
| `nfe-xml-service.ts` | Gera/persiste `xmlAutorizado` |
| `timeline-service.ts` | Agrupa cadeias para o dashboard |
| `tax-rule-service.ts` | Resolve regra origem×destino |
| `tax-rule-catalog-service.ts` | CRUD/importação de regras |
| `tax-calculation-service.ts` | Monta linha + chama `tax-engine` |
| `fiscal-service.ts` | Soft delete NF-e / CT-e |
| `fiscal-emitter-settings-service.ts` | Configurações do emissor ML |

Cada pasta expõe um `index.ts` com re-exports dos símbolos públicos. Mapa complementar: [`src/services/README.md`](./src/services/README.md).

---

## Pacotes do monorepo

```
packages/
├── fiscal-core/     # nfe-xtexto, product-pricing, fiscal-emitter-runtime
└── nfe-xml/         # Gerador XML NF-e 4.00 (buildRemessa, buildVenda, …)
```

Antes de rodar testes ou build do backend, os pacotes precisam estar compilados:

```bash
pnpm --filter @msimulation-xml/fiscal-core build
pnpm --filter @msimulation-xml/nfe-xml build
```

O script `pnpm test` do backend já faz isso automaticamente.

---

## Padrões de código

### 1. Validação com Zod

Schemas ficam em `src/schemas/<domínio>/` (ex.: `schemas/catalog/product.ts`). Sempre parse antes de usar:

```typescript
const body = productCreateBody.parse(req.body);
```

Erros Zod viram 400 via `handleRouteError` ou automaticamente pelo error handler global.

### 2. Erros de domínio

Services lançam classes específicas com `.status` HTTP:

```typescript
export class RemessaError extends Error {
  status = 422;
  constructor(message: string) {
    super(message);
    this.name = "RemessaError";
  }
}
```

Nas rotas, use `handleRouteError` de [`src/lib/http/domain-errors.ts`](./src/lib/http/domain-errors.ts):

```typescript
} catch (e) {
  if (handleRouteError(reply, e, { mappings: [{ type: RemessaError, status: 422 }] })) return;
  throw e;
}
```

### 3. Mappers

Prisma retorna entidades internas; a API expõe DTOs via mappers em `src/lib/<domínio>/` (ex.: `org/tenant-mapper.ts`, `fiscal/fiscal-mappers.ts`). Não retorne o model Prisma cru se houver campos sensíveis ou formatos diferentes.

### 4. Imports ESM

O projeto usa `"type": "module"`. Imports locais **precisam** da extensão `.js`:

```typescript
import { prisma } from "./lib/db/prisma.js";
```

### 5. Comentários

Comentários explicam **por quê** (regra fiscal, ordem de rotas, invariantes). Evite repetir o que o código já diz. Rotas fiscais complexas têm cabeçalho JSDoc — siga esse padrão.

---

## Como implementar uma funcionalidade nova

Checklist recomendado (ordem importa):

### 1. Entender o domínio

- Leia o fluxo no [README raiz](../README.md) (cadeias NF-e, FIFO, tipos).
- Identifique se afeta emissão, leitura ou configuração.

### 2. Modelagem (se necessário)

```bash
# Edite prisma/schema.prisma
pnpm --filter @msimulation-xml/backend db:migrate
pnpm --filter @msimulation-xml/backend db:generate
```

- Adicione `tenant_id` em tabelas multi-tenant.
- Crie índices em FKs.
- Se a tabela for de negócio, inclua política RLS na migration.

### 3. Service

- Crie ou estenda um arquivo em `src/services/<domínio>/`.
- Use transação quando houver múltiplas escritas.
- Reutilize `tax-calculation-service`, `remessa-fifo`, mappers existentes.

### 4. Schema Zod + rota

- Schema em `src/schemas/<domínio>/` (se reutilizável).
- Handler fino: parse → `tenantIdFromRequest` → service → status code.
- Registre a rota no plugin de contexto correto (`fiscal`, `catalog`, etc.) ou no `index.ts` do domínio em `routes/`.

### 5. Frontend (outro pacote)

- Tipos espelhados em `frontend/src/lib/fiscal-types.ts`.
- Client HTTP em `frontend/src/lib/fiscal-api.ts`.

### 6. Teste

- Lógica pura → teste unitário em `src/lib/<domínio>/*.test.ts` ou `src/services/<domínio>/*.test.ts`.
- Rode `pnpm test:backend` na raiz.

---

## Como investigar e corrigir bugs

### Onde começar

| Sintoma | Onde olhar |
|---------|------------|
| 401 / sessão encerrada | `plugins/auth`, `tokenVersion`, cookies no frontend |
| 403 tenant / e-mail | `guards.ts`, onboarding incompleto |
| 409 duplicado | Prisma P2002 — constraint unique (SKU, CNPJ…) |
| Saldo remessa insuficiente | `services/fiscal/remessa-fifo.ts`, remessas do produto/CD |
| Imposto divergente | `tax-engine.ts`, `TaxRule` do produto, UF origem/destino |
| XML errado | `services/fiscal/nfe-xml-service`, pacote `nfe-xml`, `fiscalPayload` |
| Dados de outro tenant | RLS, `tenantIdFromRequest`, query sem filtro |

### Debug local

```bash
# Só a API com reload
pnpm --filter @msimulation-xml/backend dev

# Logs SQL (temporário — adicione "query" em lib/db/prisma.ts log array)
# Prisma Studio para inspecionar dados
pnpm --filter @msimulation-xml/backend exec prisma studio
```

### Fluxo típico de correção

1. Reproduza via frontend ou `curl` com token válido.
2. Leia o log Fastify (request id + stack em 500).
3. Trace a rota → service → query Prisma.
4. Escreva ou ajuste teste que falha antes do fix.
5. Corrija no **service** ou **lib**, não na rota (salvo validação HTTP).

### Testar endpoint manualmente

```bash
# Login
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"voce@exemplo.com","password":"senha"}'

# Usar accessToken retornado
curl -s http://localhost:3001/api/products \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

---

## Testes

```bash
# Na raiz — build dos pacotes + testes backend
pnpm test:backend

# Só backend
pnpm --filter @msimulation-xml/backend test
```

Arquivos de teste atuais:

| Arquivo | Cobertura |
|---------|-----------|
| `src/lib/fiscal/tax-engine.test.ts` | Cálculo ICMS, totais, arredondamento |
| `src/lib/http/domain-errors.test.ts` | Helper `handleRouteError` e erros HTTP |
| `src/services/fiscal/remessa-fifo.test.ts` | Consumo e estorno FIFO |
| `src/services/fiscal/venda-chain-contract.test.ts` | Contrato da cadeia de venda |

Framework: **Node.js test runner** (`node --import tsx --test`).

---

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | API + frontend (raiz) |
| `pnpm --filter @msimulation-xml/backend dev` | Só API com hot reload |
| `pnpm --filter @msimulation-xml/backend build` | `prisma generate` + `tsc` |
| `pnpm --filter @msimulation-xml/backend start` | Produção (`node dist/index.js`) |
| `pnpm --filter @msimulation-xml/backend db:migrate` | Nova migration (dev) |
| `pnpm --filter @msimulation-xml/backend db:migrate:deploy` | Aplica migrations |
| `pnpm --filter @msimulation-xml/backend db:generate` | Regenera Prisma Client |
| `pnpm test:backend` | Testes + build pacotes fiscais |

---

## Referências

| Documento | Conteúdo |
|-----------|----------|
| [README raiz](../README.md) | Visão geral do monorepo, deploy, segurança |
| [docs/SECURITY.md](../docs/SECURITY.md) | Hardening, cookies, CORS, RLS |
| [src/services/README.md](./src/services/README.md) | Mapa rápido de services por domínio |
| [src/routes/fiscal/](./src/routes/fiscal/) | Rotas fiscais (nfes, ctes, pedidos, tax-rules, …) |
| [src/lib/http/domain-errors.ts](./src/lib/http/domain-errors.ts) | Tratamento padronizado de erros nas rotas |
| [`.env.example`](./.env.example) | Variáveis de ambiente |
| [`.cursor/rules/02-backend-fastify.mdc`](../.cursor/rules/02-backend-fastify.mdc) | Convenções Fastify do projeto |
| [`.cursor/rules/01-db-dba.mdc`](../.cursor/rules/01-db-dba.mdc) | Convenções Prisma / multi-tenant |

---

## Glossário rápido

| Termo | Significado |
|-------|-------------|
| **Full / fulfillment** | Modelo ML com depósito temporário do seller |
| **Remessa física** | NF-e de envio de estoque ao CD |
| **Retorno simbólico** | NF-e de entrada simbólica antes da venda |
| **FIFO** | First In, First Out — consome remessa mais antiga |
| **refNFe / NFref** | Referência XML à NF-e anterior na cadeia |
| **xTexto** | Campo `obsCont` com ID externo estilo Mercado Livre |
| **RLS** | Row-Level Security — isolamento no PostgreSQL |
| **Tenant** | Empresa emitente (CNPJ) no sistema multi-tenant |

---

Desenvolvido como simulador fiscal educacional. Dúvidas sobre regras de negócio fiscal real devem ser validadas com contador ou documentação SEFAZ — o código modela o fluxo ML Full para estudo e prototipação.

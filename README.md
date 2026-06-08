<p align="center">
  <img src="docs/assets/msimulation-logo.svg" alt="MSimulation XML" width="96" height="96" />
</p>

<h1 align="center"><strong>M</strong><code>Simulation</code> <sup>XML</sup></h1>

<p align="center"><strong>Cockpit fiscal de fulfillment</strong></p>
<p align="center"><em>por Matheus Santos — simulação, inspeção e edição de documentos fiscais</em></p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-000?logo=next.js" alt="Next.js 15" /></a>
  <a href="https://fastify.dev/"><img src="https://img.shields.io/badge/Fastify-API-000?logo=fastify" alt="Fastify" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma" alt="Prisma" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql" alt="PostgreSQL" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" /></a>
</p>

<p align="center">
  <a href="https://msimulation-xml.vercel.app"><strong>App em produção</strong></a>
  ·
  <a href="https://msimulation-xml-api.onrender.com/api/health">API health</a>
</p>

**MSimulation XML** é um cockpit fiscal e logístico para simular e inspecionar emissão de **NF-e (modelo 55, v4.00)** e **CT-e (modelo 57)** em operações de **fulfillment** — o mesmo desenho operacional usado por marketplaces com depósito temporário (full), cruzamento **origem × destino (UF)** e cadeias documentais encadeadas por `refNFe`.

> **Aviso legal:** simulador educacional e de arquitetura. XMLs gerados usam homologação (`tpAmb=2`), assinaturas fictícias e **não possuem validade** perante a SEFAZ. Não utilize em produção fiscal real sem certificação, transmissão e assessoria especializada.

---

## Índice

- [Visão geral](#visão-geral)
- [Fluxo operacional (fulfillment)](#fluxo-operacional-fulfillment)
- [Arquitetura do sistema](#arquitetura-do-sistema)
- [Engine tributária](#engine-tributária)
- [Documentos fiscais suportados](#documentos-fiscais-suportados)
- [Stack e estrutura do monorepo](#stack-e-estrutura-do-monorepo)
- [API REST (resumo)](#api-rest-resumo)
- [Interface web](#interface-web)
- [Identidade visual](#identidade-visual)
- [Como rodar localmente](#como-rodar-localmente)
- [Deploy em produção](#deploy-em-produção)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Segurança](#segurança)
- [Scripts úteis](#scripts-úteis)
- [Dados de referência (XMLs/)](#dados-de-referência-xmls)
- [Roadmap e limitações](#roadmap-e-limitações)

---

## Visão geral

O sistema cobre o ciclo típico de um seller no full:

1. **Cadastro** de produtos com regra fiscal, preço de venda e preço de custo (remessa).
2. **Remessa** de estoque para o depósito do operador logístico (ML).
3. **Retorno simbólico** + **venda** ao consumidor, consumindo saldo FIFO da remessa.
4. **Devolução** referenciada à venda, com **remessa simbólica** de retorno de saldo ao full.
5. **CT-e** de transporte vinculado à remessa e à venda (referência `infNFe`).

Tudo é **multi-tenant**: cada empresa (`Tenant`) tem séries, configurações fiscais, produtos e documentos isolados. O **tenant ativo** vem do JWT do usuário logado (não é mais passado por query string). Isolamento reforçado por **Row-Level Security (RLS)** no PostgreSQL e papéis **ADMIN** / **MEMBER** por tenant.

---

## Fluxo operacional (fulfillment)

### Cenários completos modelados

```mermaid
flowchart TB
  subgraph C1["Cenário 1 — Venda simples"]
    R1[Remessa física<br/>sem refNFe] --> RT1[Retorno simbólico<br/>refNFe → remessa]
    RT1 --> V1[Venda<br/>refNFe → retorno]
  end

  subgraph C2["Cenário 2 — Devolução ao full"]
    R2[Remessa] --> RT2[Retorno] --> V2[Venda]
    V2 --> D2[Devolução<br/>refNFe → venda]
    D2 --> RS2[Remessa simbólica<br/>refNFe → devolução]
    RS2 --> RT2b[Retorno] --> V2b[Nova venda]
  end

  subgraph C3["Cenário 3 — Avanço entre CDs"]
    R3[Remessa CD A] --> RS3[Remessa simbólica<br/>saída CD A]
    RS3 --> R3b[Remessa física CD B]
    R3b --> RT3[Retorno] --> V3[Venda]
  end
```

### Sequência de emissão (backend)

```mermaid
sequenceDiagram
  participant U as Usuário / Pedido
  participant API as Fastify API
  participant FIFO as Remessa FIFO
  participant ENG as Tax Engine
  participant DB as PostgreSQL

  U->>API: POST /products (regra fiscal + preços)
  U->>API: Emitir remessa (produto + qtd)
  API->>ENG: Resolve CFOP/alíquotas origem×destino
  API->>DB: NF-e REMESSA + CT-e remessa
  Note over API,DB: Remessa sem NFref — primeira da cadeia

  U->>API: POST /pedidos/:id/faturar
  API->>FIFO: Consumir saldo (mais antiga primeiro)
  FIFO->>DB: Débito saldo_remessa + NfeRemessaConsumo
  API->>DB: NF-e RETORNO (ref → remessa FIFO)
  API->>ENG: Cálculo venda item a item
  API->>DB: NF-e VENDA (ref → retorno)
  API->>DB: CT-e venda (ref → chave NF-e)

  U->>API: POST /nfes/:chave/devolucao
  API->>DB: NF-e DEVOLUÇÃO (ref → venda)
  API->>FIFO: Estorno saldo → remessa original
  API->>DB: NF-e REMESSA_SIMBOLICA (ref → devolução)
```

### Regras de referência (`refNFe` no XML)

| Tipo de NF-e | Possui `refNFe`? | Referencia |
|--------------|------------------|------------|
| Remessa física (entrada estoque no full) | Não | — (documento raiz) |
| Retorno simbólico | Sim | Remessa cujo saldo foi consumido (FIFO) |
| Venda | Sim | Retorno simbólico |
| Devolução | Sim | Venda |
| Remessa simbólica | Sim | Devolução |

A **timeline** na home agrupa cenários por remessa física: cada venda gera um “Cenário N” sob a mesma remessa de origem.

---

## Arquitetura do sistema

```mermaid
flowchart LR
  subgraph Frontend["Frontend — Next.js 15"]
    UI[App Router / React 19]
    XGEN[xml-generator.ts<br/>cte-xml-generator.ts]
    UI --> XGEN
  end

  subgraph Backend["Backend — Fastify"]
    ROUTES[Routes + Zod]
    SVC[Services]
    LIB[lib/<br/>tax-engine · nfe-xtexto · chave]
    ROUTES --> SVC --> LIB
  end

  subgraph Data["Dados"]
    PG[(PostgreSQL)]
    PRISMA[Prisma ORM]
    PRISMA --> PG
  end

  UI -->|REST JSON| ROUTES
  SVC --> PRISMA
  XGEN -.->|simulação local| UI
```

| Camada | Responsabilidade |
|--------|------------------|
| **Routes** | Contratos HTTP, validação Zod, status codes |
| **Services** | Regras de negócio: remessa, cadeia venda, devolução, FIFO, CT-e |
| **lib/tax-engine** | Cálculo puro ICMS “por dentro”, PIS/COFINS/IPI, totais = soma dos itens |
| **lib/tax-calculation-service** | Ponte planilha/Prisma → engine |
| **Frontend lib/** | Geração de XML fiel ao layout ML (simulação visual) |

Princípios: **monolito modular** (pnpm workspaces), multi-tenancy por `tenant_id`, sem transmissão SEFAZ.

---

## Engine tributária

A engine (`backend/src/lib/tax-engine.ts`) implementa:

- **Base de cálculo em cascata:** `vBC = vProd + vFrete + despesas − vDesc`
- **ICMS embutido** (“imposto por dentro”) por item
- **Arredondamento comercial** em 2 casas em cada `<det>`
- **`<ICMSTot>`** exclusivamente como `reduce()` dos itens (evita divergência 532/533)
- **DIFAL / FCP** quando configurado no emitente e interestadual

As alíquotas vêm da tabela `TaxRule`, importada por planilha, cruzando:

- UF origem × UF destino  
- Tipo de transação (`sale`, `inbound`, remessa…)  
- Tipo de cliente (`taxpayer` / `non_taxpayer`)  
- `taxRuleBaseId` no produto  

---

## Documentos fiscais suportados

### NF-e

| Tipo | `tpNF` | Uso do preço | CT-e |
|------|--------|--------------|------|
| `REMESSA` | Saída | `precoCusto` | Sim (→ full) |
| `RETORNO_SIMBOLICO` | Entrada | Custo / regra inbound | Não |
| `VENDA` | Saída | `preco` (venda) | Sim (→ consumidor) |
| `DEVOLUCAO` | Entrada | Espelha venda | Não |
| `REMESSA_SIMBOLICA` | Saída | `precoCusto` | Não |

### Tag `xTexto` (`obsCont`, `xCampo="external_id"`)

Padrão extraído dos XMLs reais em `XMLs/` (Mercado Livre / OLSS):

| Operação | Exemplo de `xTexto` |
|----------|---------------------|
| Remessa | `INBOUND-inbound-{pedidoMl}-1-1-OLSS-279642028` |
| Retorno | `SALE-symbolic_inbound_return-{pedidoMl}-1-OLSS-279642028` |
| Venda | `SALE-sale-{pedidoMl}-1-OLSS-279642028` |
| Venda consumidor final | `{pedidoMl}` (somente ID) |
| Devolução | `DEVOLUTION-devolution-{pedidoMl}-1-OLSS-279642028` |
| Remessa simbólica | `DEVOLUTION-symbolic_inbound-{pedidoMl}-1-OLSS-279642028` |

Gerado em `nfe-xtexto.ts` e persistido em `fiscalPayload.obsContXTexto`.

### CT-e

- **Remessa:** transporte emitente → depósito full (`cte-remessa-service`)
- **Venda:** transporte full → consumidor (`cte-venda-service`), com `<infNFe><chave>…</chave></infNFe>`

---

## Stack e estrutura do monorepo

```
msimulation-xml/
├── backend/                    # API Fastify + engine fiscal (ver `backend/docs/COMENTARIOS.md`)
│   ├── prisma/                 # Schema e migrations
│   └── src/
│       ├── lib/                # tax-engine, nfe-xtexto, chaves, mappers
│       ├── routes/             # REST
│       ├── schemas/            # Zod
│       └── services/           # remessa, venda-chain, devolucao, fifo, cte-*
├── frontend/                   # Next.js 15 App Router
│   └── src/
│       ├── app/                # Dashboard, NF-e, CT-e, produtos, regras…
│       ├── components/
│       └── lib/                # xml-generator, fiscal-api, tipos
├── docs/                       # SECURITY.md, assets da marca
├── XMLs/                       # XMLs reais de referência (ML) — não versionar em PR público se sensível
├── .github/workflows/ci.yml    # Lint, build e testes no PR
├── docker-compose.yml
└── package.json                # Scripts raiz (pnpm workspaces)
```

**Backend:** Fastify · Zod · Prisma 7 · PostgreSQL  
**Frontend:** Next.js 15 · React 19 · Tailwind CSS 4 · Radix / shadcn-style components  

---

## API REST (resumo)

| Área | Endpoints principais |
|------|----------------------|
| Tenants | `GET/POST /tenants`, `DELETE /tenants/:id` |
| Produtos | `GET/POST /products`, `POST /products/bulk-upsert` |
| Pedidos | `GET/POST /pedidos`, `POST /pedidos/:id/faturar`, `POST /pedidos/checkout` |
| NF-e | `GET /nfes`, `GET /nfes/:chave`, `POST /nfes/:chave/devolucao` |
| CT-e | `GET /ctes`, `GET /ctes/:chave` |
| Regras | `GET /tax-rules`, `POST /tax-rules/bulk-upsert` |
| Unidades ML | `GET /unidades-logisticas`, `POST /unidades-logisticas/bulk-import`, `PATCH /unidades-logisticas/:id/padrao` |
| Movimentações | `POST /movimentacoes/avanco-cd`, `GET /movimentacoes-produto` |
| Configurações | `GET/PUT /fiscal-settings` |
| Timeline | `GET /timeline` (cadeias por remessa) |
| Lookup | `GET /lookup/cnpj/:cnpj`, `GET /lookup/cep/:cep` (JWT; sem tenant — onboarding) |

Base URL local: `http://localhost:3001` (prefixo conforme proxy do frontend em `/api`).

### Autenticação (JWT)

| Método | Caminho | Auth | Descrição |
|--------|---------|------|-----------|
| `POST` | `/api/auth/register` | — | Criar conta (CAPTCHA Turnstile em produção) |
| `POST` | `/api/auth/login` | — | Sessão (access + refresh JWT) ou desafio 2FA |
| `POST` | `/api/auth/login/verify-2fa` | — | Conclui login com TOTP |
| `POST` | `/api/auth/forgot-password` | — | Envia e-mail de reset (Resend) |
| `POST` | `/api/auth/reset-password` | — | Body `{ token, password }` |
| `POST` | `/api/auth/verify-email` | — | Confirma e-mail via token do link |
| `POST` | `/api/auth/resend-verification` | Bearer | Reenvia link de verificação |
| `POST` | `/api/auth/onboarding/tenant` | Bearer | Cadastra empresa (vira **ADMIN**) |
| `GET` | `/api/auth/me` | Bearer | Perfil, tenant, `role`, `emailVerified` |
| `POST` | `/api/auth/refresh` | — | Renova access token |
| `POST` | `/api/auth/logout` | Bearer | Encerra sessão |
| `GET` | `/api/auth/2fa/status` | Bearer | Status do 2FA |
| `POST` | `/api/auth/2fa/setup` | Bearer | Inicia configuração TOTP |
| `POST` | `/api/auth/2fa/enable` | Bearer | Ativa 2FA |
| `POST` | `/api/auth/2fa/disable` | Bearer | Desativa 2FA |

Rotas de negócio exigem **JWT válido**, **e-mail verificado** e **tenant** cadastrado. Operações sensíveis (exclusão em massa de regras, gestão de usuários, importação de CDs) exigem papel **ADMIN**.

Cookies HttpOnly no frontend; detalhes de deploy em [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Interface web

| Rota | Função |
|------|--------|
| `/login` | Login / criar conta |
| `/login/verificar-email` | Aguardar ou reenviar confirmação de e-mail |
| `/login/verificar-2fa` | Segundo fator após login |
| `/login/esqueci-senha` | Solicitar e-mail de redefinição |
| `/login/redefinir-senha?token=…` | Nova senha (link do e-mail) |
| `/onboarding/empresa` | Cadastro da empresa (após e-mail verificado) |
| `/conta/seguranca` | 2FA TOTP |
| `/usuarios` | Gestão de usuários do tenant (**ADMIN**) |
| `/` | Dashboard, KPIs, timeline de cadeias, preview XML |
| `/produtos` | CRUD, importação planilha, remessa em lote |
| `/unidades-logisticas` | Importação CDs Meli Full, CD padrão de remessa, avanço entre CDs |
| `/pedidos` | Rascunhos e faturamento (cadeia retorno + venda) |
| `/nfe` | Listagem, devolução, visualização XML |
| `/cte` | CT-e de remessa e venda |
| `/regras` | Catálogo de regras tributárias |
| `/configuracoes-fiscais` | Emitente: DIFAL, frete, CST devolução, séries… |
| `/empresas` | Multi-tenant |
| `/auditoria` | Logs append-only |
| `/eventos` | Eventos fiscais simulados |

---

## Identidade visual

| Elemento | Valor |
|----------|-------|
| **Marca** | MSimulation XML |
| **Tagline** | Cockpit fiscal de fulfillment |
| **Autor** | Matheus Santos |
| **Âmbar** (`--brand-glow`) | Destaques fiscais, CTAs, ambiente simulação |
| **Esmeralda** (`--brand-xml`) | XML, `refNFe`, código e badges técnicos |
| **Logo** | `docs/assets/msimulation-logo.svg` · favicon em `frontend/public/favicon.svg` |
| **Componente** | `frontend/src/components/brand-logo.tsx` |
| **Constantes** | `frontend/src/lib/brand.ts` |

Paleta pensada para um terminal fiscal escuro: fundo grafite, acento âmbar (documentos fiscais) e verde esmeralda (syntax XML).

---

## Como rodar localmente

### Pré-requisitos

- Node.js **20+**
- pnpm **9+**
- Docker (PostgreSQL)

### Passos

```bash
# 1. Dependências
pnpm install

# 2. Variáveis de ambiente (ver seção abaixo e .env.example)
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local   # opcional; defaults funcionam em dev

# Gere segredos distintos para JWT e pepper:
# openssl rand -base64 32

# 3. Banco + migrations
pnpm db:setup

# 4. Desenvolvimento (API :3001 + Web :3000)
pnpm dev
```

Acesse http://localhost:3000/login e **crie uma conta** → confirme o e-mail (link no inbox ou log do backend) → cadastre a empresa no onboarding. O middleware redireciona para `/login` sem cookie válido.

> **Trocou `JWT_SECRET` ou `PASSWORD_PEPPER`?** Sessões antigas expiram; senhas hashadas com pepper anterior deixam de funcionar — use reset de senha ou recrie o usuário em dev.

> **Migração de `msedit-xml` / `e-invoice-play`:** se você já tinha o Postgres local com o banco antigo, rode `pnpm docker:reset` e `pnpm db:setup` para recriar o banco `msimulation_xml`, ou ajuste `DATABASE_URL` / `POSTGRES_*` nos `.env`. Renomeie o repositório no GitHub para `msimulation-xml` e atualize o remote: `git remote set-url origin https://github.com/<user>/msimulation-xml.git`.

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API Fastify | http://localhost:3001 |
| Prisma Studio | `pnpm --filter @msimulation-xml/backend db:studio` |

---

## Variáveis de ambiente

Três arquivos, três papéis:

| Arquivo | Uso |
|---------|-----|
| `.env` (raiz) | Docker Postgres (`POSTGRES_*`, referência de `DATABASE_URL`) |
| `backend/.env` | API Fastify — JWT, pepper, CORS, Resend, Turnstile |
| `frontend/.env.local` | Next.js — `API_URL` (server-only), Turnstile site key |

### Backend (`backend/.env`)

Obrigatórias para subir a API:

```env
DATABASE_URL=postgresql://msimulation:msimulation@localhost:5432/msimulation_xml?schema=public
JWT_SECRET=                    # mín. 16 (dev) / 32 (prod) — valor único
PASSWORD_PEPPER=               # mín. 16 — distinto do JWT_SECRET
APP_PUBLIC_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
```

Recomendadas / produção:

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL="MSimulation XML <noreply@seudominio.com>"
TURNSTILE_SECRET_KEY=          # CAPTCHA no registro (ignorado em dev sem chave)
REQUIRE_EMAIL_VERIFICATION=false  # Pré-lançamento: false. Go-live: true
EMAIL_VERIFICATION_EXPIRES_IN=24h
TRUST_PROXY=false              # true em produção atrás de reverse proxy
```

Sem `RESEND_API_KEY` em desenvolvimento, links de reset e verificação aparecem no **console da API**.

Referência completa: [`backend/.env.example`](backend/.env.example).

### Frontend (`frontend/.env.local`)

```env
API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_TURNSTILE_SITE_KEY=   # opcional em dev; obrigatório em prod com registro aberto
```

Preferir `API_URL` (server-only) em vez de `NEXT_PUBLIC_API_URL`. Referência: [`frontend/.env.example`](frontend/.env.example).

---

## Deploy em produção

Aplicação publicada em **Vercel** (frontend) + **Render** (API Docker + PostgreSQL). Cada push na branch `main` dispara deploy automático nos dois provedores, após o CI do GitHub Actions.

### URLs

| Ambiente | Serviço | URL |
|----------|---------|-----|
| Produção | Frontend (Next.js) | https://msimulation-xml.vercel.app |
| Produção | API (Fastify) | https://msimulation-xml-api.onrender.com |
| Produção | Health check | https://msimulation-xml-api.onrender.com/api/health |
| Repositório | GitHub | https://github.com/Matheus-santos7/MSimulation-XML |

### Fluxo automático

```mermaid
flowchart LR
  dev[Push em main] --> gha[GitHub Actions CI]
  dev --> vercel[Vercel — frontend]
  dev --> render[Render — API Docker]
  gha -->|lint build testes| ok[Verde / vermelho]
  vercel --> web[msimulation-xml.vercel.app]
  render --> api[msimulation-xml-api.onrender.com]
  render --> pg[(PostgreSQL Render)]
  web -->|API_URL| api
```

1. **CI** (`.github/workflows/ci.yml`): lint, build, testes e audit em todo push/PR.
2. **Vercel**: projeto `msimulation-xml`, `rootDirectory: frontend`, build do monorepo via `frontend/vercel.json`.
3. **Render**: Web Service Docker (`Dockerfile` na raiz), migrations no start (`prisma migrate deploy`), Postgres gerenciado.

### Arquivos de infraestrutura

| Arquivo | Função |
|---------|--------|
| [`frontend/vercel.json`](frontend/vercel.json) | Install/build do monorepo pnpm na Vercel |
| [`Dockerfile`](Dockerfile) | Imagem da API (Fastify + pacotes workspace) |
| [`render.yaml`](render.yaml) | Blueprint Render (API + Postgres, IaC) |
| [`.dockerignore`](.dockerignore) | Contexto enxuto para build Docker |

### Primeira configuração (uma vez)

**Vercel**

1. Importe o repositório `Matheus-santos7/MSimulation-XML` (ou `vercel git connect`).
2. Defina **Root Directory** = `frontend` e habilite **Include files outside root** (monorepo).
3. Variáveis de ambiente em **Production**:

| Variável | Valor |
|----------|-------|
| `API_URL` | `https://msimulation-xml-api.onrender.com` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | chave pública Turnstile (se registro aberto) |

**Render**

1. Crie o Blueprint a partir do `render.yaml` **ou** um Web Service Docker apontando para o mesmo repositório (`branch: main`, auto-deploy ligado).
2. Vincule o Postgres `msimulation-xml-db` ao serviço (`DATABASE_URL` via **Link Database**).
3. Preencha no dashboard as variáveis marcadas com `sync: false` no blueprint:

| Variável | Descrição |
|----------|-----------|
| `RESEND_API_KEY` | E-mail transacional |
| `RESEND_FROM_EMAIL` | Remetente verificado no Resend |
| `REQUIRE_EMAIL_VERIFICATION` | `false` pré-lançamento; `true` no go-live |
| `TURNSTILE_SECRET_KEY` | CAPTCHA no registro |

`JWT_SECRET` e `PASSWORD_PEPPER` podem ser gerados pelo Render (`generateValue` no blueprint) ou definidos manualmente (≥ 32 e ≥ 16 caracteres).

### Deploy manual (opcional)

```bash
# Frontend
cd frontend && npx vercel --prod

# Backend — redeploy do serviço já existente
render deploys create <SERVICE_ID> --wait
```

### Checklist de segurança

Detalhes em [`docs/SECURITY.md`](docs/SECURITY.md): `CORS_ORIGINS` e `APP_PUBLIC_URL` com HTTPS do frontend, `TRUST_PROXY=true`, segredos fortes, Postgres sem porta pública, RLS aplicado.

---

## Segurança

Camadas principais já no código:

| Área | Medida |
|------|--------|
| Autenticação | JWT + refresh rotativo, lockout de login, 2FA TOTP, verificação de e-mail |
| Registro aberto | Rate limit, Turnstile, bloqueio de domínios descartáveis |
| Autorização | RBAC `ADMIN` / `MEMBER`; guards nas rotas sensíveis |
| Multi-tenant | `tenantId` só do JWT; RLS PostgreSQL nas tabelas de negócio |
| Upload | Magic bytes XLSX, limite 15 MB, validação no frontend e backend |
| HTTP | CSP/HSTS no Next.js, Helmet no Fastify, cookies `HttpOnly`/`Secure` |
| CI | GitHub Actions (lint, build, testes) + Dependabot |

Documentação operacional: [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Frontend + backend em paralelo |
| `pnpm build` | Build de produção (web + api) |
| `pnpm db:setup` | Docker Postgres + migrate deploy |
| `pnpm docker:up` / `pnpm docker:down` | Sobe/para o container |
| `pnpm docker:reset` | Remove volume do banco |
| `pnpm lint` / `pnpm format` | ESLint e Prettier |
| `pnpm test:backend` | Testes Vitest do backend |
| `pnpm --filter @msimulation-xml/backend db:migrate` | Nova migration (dev) |

---

## Dados de referência (`XMLs/`)

A pasta `XMLs/` contém **procNFe** reais de operação fulfillment (Atlas × Mercado Livre). Use para:

- Validar layout de `refNFe`, `obsCont/xTexto`, impostos e `ICMSTot`
- Comparar com o XML gerado no inspector da aplicação
- Evoluir CFOP/natOp e templates do `xml-generator.ts`

> Recomenda-se não publicar XMLs com dados sensíveis em repositórios públicos; avalie `.gitignore` ou amostras anonimizadas.

---

## Roadmap e limitações

**Já implementado (simulação)**

- Cadeia remessa → retorno → venda → devolução → remessa simbólica  
- FIFO de saldo por produto  
- Engine tributária com totais por item  
- CT-e remessa e CT-e venda referenciados  
- Timeline agrupada por remessa  
- Importação de regras e produtos via planilha  
- Unidades logísticas Meli Full (planilha `.xlsx`), destino de remessa por CD e avanço entre CDs com rastreio fiscal  
- Autenticação completa: verificação de e-mail, 2FA, RBAC, rate limits, RLS  
- Hardening de upload e headers de segurança (CSP, HSTS)  

**Em evolução / não escopo atual**

- Transmissão real SEFAZ (autorização, cancelamento, CC-e)  
- Certificado A1/A3 e assinatura XML-DSig válida  
- Retorno simbólico automático no avanço entre CDs (hoje: remessa simbólica + remessa física no destino)  
- GNRE, MDF-e, NFS-e  
- Emissão em produção (`tpAmb=1`)  

---

## Licença e contribuição

Projeto de **prova de conceito arquitetural**. Contribuições são bem-vindas via issues e pull requests; ao submeter XMLs ou dados reais, respeite LGPD e sigilo fiscal.

Desenvolvido para estudo de engines tributárias, fulfillment e integração NF-e/CT-e em TypeScript.

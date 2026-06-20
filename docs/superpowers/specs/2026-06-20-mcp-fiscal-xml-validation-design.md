# Validação e Rastreabilidade de XMLs Fiscais via MCP Fiscal — Design Spec

**Data:** 2026-06-20  
**Status:** Concluída (2026-06-20)  
**Alvo:** Backend + Frontend (thin client)

## 1. Visão geral

Integrar o microsserviço `mcp-fiscal-brasil` (`mcp-fiscal-api`) ao simulador para validar todo XML de NF-e **após** a geração (`buildNfeXmlAutorizado`) e **antes** do commit final da transação de emissão. O status de higidez (`PENDING` / `APPROVED` / `REJECTED`) é persistido em `nfes` e exposto na UI (lista/detalhe NF-e + página IA Insights).

## 2. Infraestrutura

Serviço adicionado ao `docker-compose.yml` na raiz:

- Imagem: `ghcr.io/dehor-labs/mcp-fiscal-brasil:latest`
- Porta host: `8080` → container `8000`
- Comando: `["mcp-fiscal-api"]`
- Rede: mesma bridge do Postgres (backend local acessa via `http://localhost:8080`)

Variáveis backend (`backend/.env`):

| Variável | Default dev | Descrição |
|----------|-------------|-----------|
| `FISCAL_VALIDATOR_URL` | `http://localhost:8080` | Base URL do microsserviço |
| `FISCAL_VALIDATOR_ENABLED` | `true` | `false` pula validação (dev sem Docker) |

Endpoint MCP: `POST /api/v1/validate-nfe` body `{ "xml": "<string>" }` → `{ "valida": boolean, "erros": string[] }`.

## 3. Banco de dados (Prisma)

Enum **`NfeValidationStatus`** (código em inglês):

- `PENDING` — ainda não validado ou validador indisponível
- `APPROVED` — XML aprovado pelo MCP
- `REJECTED` — XML rejeitado (erros fiscais/estruturais)

Campos em `model NFe`:

- `statusValidacao NfeValidationStatus @default(PENDING) @map("status_validacao")`
- `mensagemValidacao String? @map("mensagem_validacao")`
- `errosValidacao Json? @map("erros_validacao")`

**CT-e:** fora do escopo v1 (mesmos campos em `ctes` numa fase futura).

## 4. Backend — arquitetura

### 4.1 Ponto único de integração

Todas as emissões passam por `persistNfeXmlAutorizado` (`backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-service.ts`). Não alterar cada use case de emissão individualmente.

Fluxo:

1. `buildNfeXmlAutorizado(...)` → string XML
2. Se `FISCAL_VALIDATOR_ENABLED`: `fiscalValidator.validateNfe(xml)`
3. `tx.nFe.update({ xmlAutorizado, statusValidacao, mensagemValidacao, errosValidacao })`

### 4.2 Regras de negócio

| Cenário | Comportamento |
|---------|----------------|
| `valida: true` | `APPROVED`, mensagem `"XML aprovado"`, `errosValidacao: null` |
| `valida: false` | `REJECTED`, mensagem padrão de rejeição, `errosValidacao: data.erros` — **não abortar transação** |
| Validador desabilitado | `PENDING`, mensagem `"Validação desabilitada"` |
| HTTP/timeout do MCP | `PENDING`, mensagem `"Validador indisponível: …"` — **não abortar emissão** |

### 4.3 Port + adapter

- Port: `backend/src/modules/fiscal-documents/domain/ports/fiscal-validator.port.ts`
- HTTP adapter: `backend/src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.ts`
- Fake adapter (testes): `backend/src/modules/fiscal-documents/infrastructure/external/fake-fiscal-validator.adapter.ts`

### 4.4 API + DTO

Estender `mapNfe` e `NFeDto` (frontend `fiscal-types.ts`) com:

```typescript
validationStatus: "PENDING" | "APPROVED" | "REJECTED";
validationMessage?: string;
validationErrors?: string[];
```

Novo endpoint agregador para IA:

- `GET /api/fiscal-validation/insights` — rejeições recentes, top erros, contadores (últimos 7 dias)

## 5. Frontend (thin client)

- **Lista/detalhe NF-e:** badge `ValidationStatusBadge` + bloco de erros no detalhe quando `REJECTED`
- **Página IA** (`frontend/src/app/(app)/ia/page.tsx`): substituir `INSIGHTS` estáticos por dados de `GET /api/fiscal-validation/insights` via `fiscal-api`
- Zero validação fiscal no browser

## 6. Fora de escopo v1

- Validação de CT-e
- Re-validação assíncrona em background de NF-es antigas
- Bloqueio hard de emissão quando `REJECTED` (apenas rastreabilidade + UI)

## 7. Verificação

```bash
pnpm build
pnpm test:backend
# Com Docker:
pnpm docker:up && curl -sf http://localhost:8080/health || true
```

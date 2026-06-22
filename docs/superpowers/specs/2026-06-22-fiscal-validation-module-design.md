# Módulo fiscal-validation (MCP) — Design Spec

**Data:** 2026-06-22  
**Status:** Aprovado  
**Escopo:** Backend + documentação fiscal  
**Relacionado:** [mcp-fiscal-xml-validation-design.md](./2026-06-20-mcp-fiscal-xml-validation-design.md) (v1 concluída)

## 1. Objetivo

Extrair a integração com o **mcp-fiscal-brasil** (via proxy FastAPI) para um bounded context dedicado em Clean Architecture + DDD (`fiscal-validation`), documentar o fluxo de envio do XML e devolutiva, e **eliminar retornos de auditoria inventados no backend** — apenas pass-through do `resumo`/`erros`/`achados` do MCP, com mensagens fixas restritas a estados operacionais (validador desabilitado ou indisponível).

## 2. Problema atual

| Local | Problema |
|-------|----------|
| `backend/src/lib/fiscal-validator-*.ts` | Config, factory e health probe fora de módulo |
| `fiscal-documents/domain/ports/fiscal-validator.port.ts` | Port de integração MCP no contexto errado |
| `fiscal-documents/infrastructure/xml/nfe-xml-validation.ts` | Regra de orquestração misturada com camada XML |
| `http-fiscal-validator.adapter.ts` | Fallbacks fixos: `"NF-e aprovada..."`, `REJECTED_MESSAGE` |
| `fiscal-observability.controller.ts` | Rotas MCP misturadas com timeline/audit-logs |

## 3. Abordagem escolhida

**Bounded context `fiscal-validation`** (módulo top-level em `backend/src/modules/fiscal-validation/`).

Alternativas descartadas:

- Subpasta em `fiscal-documents` — fronteira DDD fraca.
- Package npm compartilhado — overkill; só o backend consome.

## 4. Estrutura do módulo

```
backend/src/modules/fiscal-validation/
├── domain/
│   ├── entities/
│   │   ├── nfe-mcp-audit.entity.ts
│   │   └── nfe-validation-outcome.entity.ts
│   ├── ports/
│   │   ├── mcp-fiscal-validator.port.ts
│   │   └── validation-insights.repository.ts
│   ├── services/
│   │   └── resolve-nfe-validation.service.ts
│   └── constants/
│       └── operational-validation-messages.ts
├── application/
│   ├── use-cases/
│   │   ├── validate-nfe-xml.use-case.ts
│   │   ├── backfill-pending-nfe-validation.use-case.ts
│   │   ├── get-validation-insights.use-case.ts
│   │   └── get-validator-health.use-case.ts
│   └── dto/
│       └── validation-insights.dto.ts
├── infrastructure/
│   ├── external/
│   │   ├── http-mcp-fiscal-validator.adapter.ts
│   │   ├── fake-mcp-fiscal-validator.adapter.ts
│   │   └── mcp-validate-nfe-response.mapper.ts
│   ├── config/
│   │   └── fiscal-validator.config.ts
│   ├── prisma/
│   │   ├── prisma-validation-insights.repository.ts
│   │   └── nfe-validation-persistence.mapper.ts
│   └── factory/
│       └── fiscal-validation-module.factory.ts
├── presentation/
│   ├── controllers/
│   │   └── fiscal-validation.controller.ts
│   └── mappers/
│       └── validation-api.mapper.ts
└── index.ts
```

### Regra de dependências

- `domain` → nada externo.
- `application` → `domain`.
- `infrastructure` / `presentation` → `application` + `domain`.
- `fiscal-documents` → `fiscal-validation` (use cases exportados).
- `fiscal-validation` **não** importa `fiscal-documents`.

## 5. Modelo de domínio

### 5.1 `NfeMcpAudit` (entity)

Espelha a resposta do proxy — fonte única de verdade para auditoria fiscal:

```typescript
type NfeValidationAchado = {
  severidade: string;
  codigo: string;
  mensagem: string;
};

type NfeMcpAudit = {
  valida: boolean;
  resumo: string;       // pass-through do MCP; pode ser ""
  erros: string[];
  achados: NfeValidationAchado[];
};
```

### 5.2 `NfeValidationOutcome` (entity)

Resultado da orquestração no domínio (antes de Prisma):

```typescript
type NfeValidationStatus = "PENDING" | "APPROVED" | "REJECTED";

type NfeValidationOutcome = {
  status: NfeValidationStatus;
  message: string | null;   // null quando MCP respondeu com resumo vazio
  errors: string[] | null;  // null quando sem erros
  audit: NfeMcpAudit | null; // null em PENDING operacional
};
```

### 5.3 `McpFiscalValidatorPort`

```typescript
interface McpFiscalValidatorPort {
  validateNfe(xmlContent: string): Promise<NfeMcpAudit>;
}
```

O port retorna **apenas** o payload de auditoria MCP. Status `APPROVED`/`REJECTED`/`PENDING` é derivado em `resolve-nfe-validation.service.ts`.

### 5.4 `ResolveNfeValidationService`

Substitui `resolveNfeValidationUpdate`. Entrada: `xml`, `validator`, `config: { enabled: boolean }`.

| Cenário | `status` | `message` | `audit` |
|---------|----------|-----------|---------|
| `enabled=false` | `PENDING` | `VALIDATION_DISABLED_MESSAGE` | `null` |
| MCP responde `valida=true` | `APPROVED` | `audit.resumo` ou `null` se vazio | `audit` |
| MCP responde `valida=false` | `REJECTED` | `audit.resumo` ou `null` se vazio | `audit` |
| Exceção HTTP/timeout | `PENDING` | `VALIDATOR_UNAVAILABLE_MESSAGE(detail)` | `null` |

**Mensagens operacionais permitidas** (único arquivo com strings fixas de negócio local):

```typescript
// domain/constants/operational-validation-messages.ts
export const VALIDATION_DISABLED_MESSAGE = "Validação desabilitada";
export function validatorUnavailableMessage(detail: string): string {
  return `Validador indisponível: ${detail}`;
}
```

**Proibido** em adapters e services de auditoria:

- `"NF-e aprovada na auditoria fiscal"`
- `"NF-e rejeitada na auditoria fiscal (estrutura, chave ou regras CAT 31)."`
- Qualquer texto inventado quando `resumo` está ausente

Erros de transporte HTTP no adapter podem usar mensagem técnica genérica apenas para `throw` (capturada upstream como `Validador indisponível: …`).

## 6. Fluxo de envio e devolutiva

### 6.1 Ponto de integração na emissão

Todas as emissões que persistem XML continuam passando por `fiscal-documents` → `persistNfeXmlAutorizado`. A diferença é que a validação MCP é delegada ao novo módulo:

```
persistNfeXmlAutorizado
  → buildNfeXmlAutorizado (nfe-xml)
  → ValidateNfeXmlUseCase.execute(xml)
      → ResolveNfeValidationService.resolve(...)
          → HttpMcpFiscalValidatorAdapter.validateNfe(xml)
              → POST {apiUrl}/api/v1/validate-nfe  body: { "xml": "<string>" }
  → nfe-validation-persistence.mapper(outcome) → Prisma.NFeUpdateInput
  → tx.nFe.update({ xmlAutorizado, ...campos })
```

A emissão **não aborta** quando `REJECTED` ou quando o validador está offline (comportamento v1 preservado).

### 6.2 Contrato HTTP (proxy → backend)

**Request**

```http
POST /api/v1/validate-nfe
Content-Type: application/json

{ "xml": "<nfeProc>...</nfeProc>" }
```

**Response** (200)

```json
{
  "valida": false,
  "resumo": "NF-e rejeitada: 1 achado(s) crítico(s), 0 alto(s), 1 no total.",
  "erros": ["[CRITICO] CFOP 6949 incompatível com CST ICMS 00"],
  "achados": [
    {
      "severidade": "critico",
      "codigo": "CFOP_CST_ICMS_REMESSA",
      "mensagem": "CFOP 6949 (remessa) incompatível com CST ICMS 00..."
    }
  ]
}
```

O proxy grava XML em arquivo temporário porque `mcp-fiscal-brasil` 0.4.0 exige `xml_path`; o backend **nunca** envia path — apenas string inline.

### 6.3 Mapeamento campo a campo

| MCP / proxy | Domínio | Prisma (`nfes`) | API `NFeDto` |
|-------------|---------|-----------------|--------------|
| `valida` | `audit.valida` | `auditoria_mcp.valida` | `validationAudit.valida` |
| `resumo` | `audit.resumo` → `outcome.message` | `mensagem_validacao` | `validationMessage` |
| `erros[]` | `audit.erros` → `outcome.errors` | `erros_validacao` (JSON) | `validationErrors` |
| `achados[]` | `audit.achados` | `auditoria_mcp.achados` | `validationAudit.achados` |
| derivado | `outcome.status` | `status_validacao` | `validationStatus` |

Mapper Prisma (`nfe-validation-persistence.mapper.ts`) vive em **infrastructure** — domain não conhece Prisma.

### 6.4 Health probe

`GetValidatorHealthUseCase` substitui `getFiscalValidatorStatus()`:

- `GET {apiUrl}/health` com timeout 5s
- Retorna `{ enabled, apiUrl, reachable, message }` — mensagens de diagnóstico de infraestrutura (não são resultado de auditoria XML).

## 7. Application layer

| Use case | Responsabilidade |
|----------|------------------|
| `ValidateNfeXmlUseCase` | Orquestra `ResolveNfeValidationService`; usado por `nfe-xml-service` |
| `BackfillPendingNfeValidationUseCase` | Revalida NF-es `PENDING` (lógica migrada de `nfe-validation-backfill.service.ts`) |
| `GetValidationInsightsUseCase` | Agregados 7 dias (migrado de fiscal-documents) |
| `GetValidatorHealthUseCase` | Probe `/health` para UI admin |

`BackfillPendingNfeValidationUseCase` depende de:

- `McpFiscalValidatorPort` + config (via factory)
- Regeneração de XML: injeta callback/port de `fiscal-documents` **ou** recebe `xml` já resolvido — preferir que backfill chame `resolveNfeXmlStringFromLoadedRow` via port `NfeXmlResolverPort` definido em fiscal-documents e injetado no composition root para evitar dependência circular.

**Resolução de dependência circular (backfill):**

- `fiscal-documents` exporta port `NfeXmlContentResolverPort { resolveForRow(row): Promise<string | null> }`
- Factory do app (ou fiscal-validation factory com injeção) recebe implementação Prisma de fiscal-documents
- `fiscal-validation` depende do **port**, não da implementação

## 8. Presentation layer

Novo controller `fiscal-validation.controller.ts` — rotas extraídas de `fiscal-observability.controller.ts`:

| Método | Rota | Use case |
|--------|------|----------|
| `GET` | `/api/fiscal-validation/status` | `GetValidatorHealthUseCase` |
| `GET` | `/api/fiscal-validation/insights` | `GetValidationInsightsUseCase` |
| `POST` | `/api/fiscal-validation/backfill` | `BackfillPendingNfeValidationUseCase` (admin) |

`fiscal-observability.controller.ts` permanece com timeline, fiscal-events e audit-logs.

Registro Fastify: adicionar plugin do novo controller; paths HTTP **inalterados** (sem breaking change de API).

## 9. Infrastructure — adapter HTTP (pass-through)

`http-mcp-fiscal-validator.adapter.ts`:

1. `POST /api/v1/validate-nfe` com `{ xml }`
2. Se `!response.ok` → `throw` (transporte)
3. `mcp-validate-nfe-response.mapper.ts` mapeia JSON → `NfeMcpAudit` sem alterar textos
4. **Sem** `REJECTED_MESSAGE`, **sem** fallback de `resumo`

`mcp-validate-nfe-response.mapper.ts`:

- `resumo`: `typeof data.resumo === "string" ? data.resumo.trim() : ""`
- `valida`: `Boolean(data.valida)`
- `erros` / `achados`: normalização de tipos apenas (coerção string), sem reescrever conteúdo

## 10. Migração e arquivos removidos

### Mover / criar

| De | Para |
|----|------|
| `src/lib/fiscal-validator-config.ts` | `fiscal-validation/infrastructure/config/` |
| `src/lib/fiscal-validator-factory.ts` | `fiscal-validation/infrastructure/factory/` |
| `src/lib/fiscal-validator-status.ts` | `GetValidatorHealthUseCase` |
| `fiscal-documents/.../fiscal-validator.port.ts` | `fiscal-validation/domain/ports/mcp-fiscal-validator.port.ts` |
| `fiscal-documents/.../http-fiscal-validator.adapter.ts` | `fiscal-validation/infrastructure/external/` |
| `fiscal-documents/.../fake-fiscal-validator.adapter.ts` | idem |
| `fiscal-documents/.../nfe-xml-validation.ts` | `resolve-nfe-validation.service.ts` |
| `fiscal-documents/.../nfe-validation-backfill.service.ts` | `backfill-pending-nfe-validation.use-case.ts` |
| `fiscal-documents/.../get-validation-insights.use-case.ts` | `fiscal-validation/application/` |
| `fiscal-documents/.../prisma-validation-insights.repository.ts` | `fiscal-validation/infrastructure/prisma/` |

### Apagar após migração

- `backend/src/lib/fiscal-validator-config.ts`
- `backend/src/lib/fiscal-validator-factory.ts`
- `backend/src/lib/fiscal-validator-status.ts`
- `backend/src/lib/fiscal-validator-config.test.ts` → mover para módulo
- Arquivos antigos listados acima em fiscal-documents

### Atualizar imports

- `nfe-xml-service.ts` → `createFiscalValidationModule().validateNfeXml`
- Testes em `nfe-xml-validation.test.ts` → mover para `fiscal-validation`
- `fiscal-observability.controller.ts` → remover rotas MCP

## 11. Documentação

Novo arquivo: **`docs/fiscal/mcp-nfe-validation-flow.md`**

Conteúdo:

1. Diagrama de sequência (emissão + backfill)
2. Contrato HTTP request/response com exemplo
3. Tabela mapeamento MCP → domínio → Prisma → DTO
4. Tabela mensagens permitidas vs proibidas no backend
5. Referência aos arquivos do módulo `fiscal-validation`

**README.md:** enxugar seção “Validador MCP Fiscal Brasil” — manter resumo operacional + link para `docs/fiscal/mcp-nfe-validation-flow.md` e este design spec.

## 12. Testes

| Arquivo | Casos |
|---------|-------|
| `mcp-validate-nfe-response.mapper.test.ts` | `resumo` propagado 1:1; `resumo` ausente → `""` |
| `http-mcp-fiscal-validator.adapter.test.ts` | sem fallback; HTTP 503 → throw |
| `resolve-nfe-validation.service.test.ts` | APPROVED/REJECTED/PENDING/disabled/unavailable |
| `nfe-validation-persistence.mapper.test.ts` | outcome → Prisma fields |
| Asserção explícita | adapter não contém strings `"NF-e aprovada na auditoria"` / `REJECTED_MESSAGE` |

## 13. Verificação

```bash
pnpm build
pnpm test:backend
```

Exit code 0 obrigatório.

## 14. Fora de escopo

- Refatorar `infra/fiscal-validator-proxy/audit.py`
- Validação CT-e via MCP
- Bloquear emissão quando `REJECTED`
- Alterações no frontend (já tolera `resumo` vazio via `validationAudit.achados`)
- Upgrade `mcp-fiscal-brasil` além de 0.4.0

## 15. Ordem de implementação sugerida

1. Criar estrutura `fiscal-validation` (domain + constants + service)
2. Migrar adapters HTTP/fake + mapper pass-through
3. Migrar config + factory + use cases
4. Migrar persistence mapper + integrar `nfe-xml-service`
5. Extrair controller + registrar rotas
6. Migrar backfill com port anti-ciclo
7. Apagar arquivos legados + atualizar testes
8. Escrever `docs/fiscal/mcp-nfe-validation-flow.md` + link no README

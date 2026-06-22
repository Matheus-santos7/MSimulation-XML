# Fluxo MCP — validação de XML NF-e

Documentação do envio do XML ao validador fiscal e da devolutiva persistida no backend.

**Design spec:** [`docs/superpowers/specs/2026-06-22-fiscal-validation-module-design.md`](../superpowers/specs/2026-06-22-fiscal-validation-module-design.md)

## Visão geral

```
persistNfeXmlAutorizado (fiscal-documents)
  → ValidateNfeXmlUseCase (fiscal-validation)
      → HttpMcpFiscalValidatorAdapter
          → POST /api/v1/validate-nfe  { "xml": "..." }
              → fiscal-validator-proxy (Python)
                  → audit_nfe_xml → mcp-fiscal-brasil 0.4.0
  → toPrismaNfeValidationUpdate(outcome)
  → nfes.status_validacao, mensagem_validacao, erros_validacao, auditoria_mcp
```

A emissão **não é bloqueada** quando o XML é rejeitado ou o validador está offline.

## Contrato HTTP (proxy)

### Request

```http
POST /api/v1/validate-nfe
Content-Type: application/json

{ "xml": "<nfeProc>...</nfeProc>" }
```

### Response (200)

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

O proxy grava o XML em arquivo temporário porque o `mcp-fiscal-brasil` 0.4.0 exige `xml_path` em disco.

## Mapeamento campo a campo

| MCP / proxy | Domínio (`NfeMcpAudit` / `NfeValidationOutcome`) | Prisma | API `NFeDto` |
|-------------|--------------------------------------------------|--------|--------------|
| `valida` | `audit.valida` | `auditoria_mcp.valida` | `validationAudit.valida` |
| `resumo` | `audit.resumo` → `outcome.message` | `mensagem_validacao` | `validationMessage` |
| `erros[]` | `audit.erros` → `outcome.errors` | `erros_validacao` | `validationErrors` |
| `achados[]` | `audit.achados` | `auditoria_mcp.achados` | `validationAudit.achados` |
| derivado | `outcome.status` | `status_validacao` | `validationStatus` |

## Mensagens no backend

### Permitidas (operacionais — não vêm do MCP)

| Mensagem | Quando | Arquivo |
|----------|--------|---------|
| `Validação desabilitada` | `FISCAL_VALIDATOR_ENABLED=false` | `operational-validation-messages.ts` |
| `Validador indisponível: {detail}` | HTTP/timeout do proxy | `operational-validation-messages.ts` |
| `Falha na comunicação com o microsserviço de validação.` | HTTP ≠ 200 (throw capturado upstream) | `operational-validation-messages.ts` |

### Proibidas no adapter de auditoria

O `HttpMcpFiscalValidatorAdapter` **não** inventa texto de aprovação/rejeição. Se o MCP retorna `resumo: ""`, `mensagemValidacao` fica `null` e a UI usa `validationAudit.achados`.

## Módulo `fiscal-validation`

| Camada | Responsabilidade |
|--------|------------------|
| `domain/services/resolve-nfe-validation.service.ts` | Orquestra port + config → `NfeValidationOutcome` |
| `infrastructure/external/http-mcp-fiscal-validator.adapter.ts` | Cliente HTTP pass-through |
| `infrastructure/prisma/nfe-validation-persistence.mapper.ts` | Outcome → Prisma |
| `application/use-cases/validate-nfe-xml.use-case.ts` | Entry point na emissão |
| `presentation/controllers/fiscal-validation.controller.ts` | `/api/fiscal-validation/*` |

## Variáveis de ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `FISCAL_VALIDATOR_URL` | `http://localhost:8080` | Base URL do proxy |
| `FISCAL_VALIDATOR_ENABLED` | `true` | `false` pula chamada MCP |

## API backend

| Método | Rota | Use case |
|--------|------|----------|
| `GET` | `/api/fiscal-validation/status` | `GetValidatorHealthUseCase` |
| `GET` | `/api/fiscal-validation/insights` | `GetValidationInsightsUseCase` |
| `POST` | `/api/fiscal-validation/backfill` | `BackfillPendingNfeValidationUseCase` |

# Módulo fiscal-validation (MCP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extrair integração MCP para bounded context `fiscal-validation` com pass-through 1:1 e documentação do fluxo XML.

**Architecture:** Clean Architecture + DDD em `backend/src/modules/fiscal-validation/`; `fiscal-documents` delega validação via `ValidateNfeXmlUseCase`; mensagens de auditoria só do MCP.

**Tech Stack:** Node.js, Fastify, Prisma, mcp-fiscal-brasil proxy (Python)

**Spec:** `docs/superpowers/specs/2026-06-22-fiscal-validation-module-design.md`

**Status:** Concluída (2026-06-22)

---

## Entregas realizadas

- [x] Domain: entities, ports, `resolve-nfe-validation.service`, operational messages
- [x] Infrastructure: HTTP adapter pass-through, mappers, Prisma persistence, config, factory
- [x] Application: validate, backfill, insights, health use cases
- [x] Presentation: `fiscal-validation.controller` + registro em `fiscal.plugin.ts`
- [x] Integração: `nfe-xml-service` usa novo módulo
- [x] Remoção: `src/lib/fiscal-validator-*`, arquivos legados em fiscal-documents
- [x] Testes: mapper, adapter, resolve service, config (108/108 backend)
- [x] Docs: `docs/fiscal/mcp-nfe-validation-flow.md`

## Verificação

```bash
pnpm test:backend
pnpm --filter @msimulation-xml/backend build
```

# Relatório de segurança e arquitetura

> Auditoria com skills **security-best-practices**, **best-practices** e **coding-guidelines**  
> Escopo: monorepo msedit-xml (Fastify + Next.js 15 + Prisma)  
> Data: 2026-06-03

## Resumo executivo

O projeto tem **boa base de autenticação multi-tenant** (JWT com `tokenVersion`, `tenantId` revalidado no banco, rate limit em `/auth/*`, pepper de senha em produção). Os maiores gaps remanescentes são **fallback de XML no frontend** e **tipagem fraca de transaction client**; CORS, helmet, rate limit e lookup autenticado já foram endereçados. A arquitetura fiscal/XML recente (`fiscal-core`, `nfe-xml`, `xml_autorizado`) está alinhada com boas práticas de fonte única de verdade.

**Correções aplicadas nesta auditoria:** CORS configurável + rate limit em lookup.

---

## Crítico

Nenhum achado crítico explotável imediato após revisão (sem IDOR cross-tenant nas rotas protegidas amostradas).

---

## Alto

### SEC-001 — CORS refletia qualquer origem

| Campo | Detalhe |
|-------|---------|
| Local | `backend/src/index.ts` (antes da correção) |
| Evidência | `await app.register(cors, { origin: true })` |
| Impacto | Qualquer site poderia chamar a API com credenciais do usuário se cookies/tokens vazarem. |
| Correção | `buildCorsOptions()` em `backend/src/lib/cors-config.ts` — `CORS_ORIGINS` em produção; dev restrito a localhost. |

### SEC-002 — Lookup CNPJ/CEP público sem autenticação ✅ corrigido

| Campo | Detalhe |
|-------|---------|
| Local | `backend/src/routes/lookup.ts`, `plugins/protected-api.ts` |
| Correção | Rate limit 30 req/min; rotas em `protected-api` com `authenticate` (sem `requireTenant` — onboarding). Frontend via `lookup-actions.ts` (Server Actions + Bearer). |

---

## Médio

### SEC-003 — Sem security headers no Fastify ✅ corrigido

| Campo | Detalhe |
|-------|---------|
| Local | `backend/src/index.ts`, `backend/src/lib/helmet-config.ts` |
| Correção | `@fastify/helmet` global; CSP desligado (API só JSON). |

### SEC-004 — Lookup sem autenticação (design) ✅ corrigido

| Campo | Detalhe |
|-------|---------|
| Local | `protected-api.ts` — lookup registrado após `authenticate`, antes de `requireTenantHook` |

### SEC-005 — XML armazenado como texto grande

| Campo | Detalhe |
|-------|---------|
| Local | `NFe.xml_autorizado` |
| Impacto | Integridade OK; backup/PII em XML — tratar backups como sensíveis. |
| Mitigação | Política de retenção; não expor XML sem `tenantId` (já filtrado em `resolveNfeXml`). |

### ARCH-001 — Geração de XML ainda duplicada na UI (fallback)

| Campo | Detalhe |
|-------|---------|
| Local | `frontend/src/lib/resolve-nfe-xml.ts` |
| Evidência | Fallback `buildNFeXML` local se API 404 |
| Impacto | Drift teórico se pacote `nfe-xml` divergir do backend (baixo após unificação). |
| Mitigação | Remover fallback quando todas as NF-e tiverem `xml_autorizado` ou backfill concluído. |

### ARCH-002 — `tx as unknown as PrismaClient` em devolução ✅ corrigido

| Campo | Detalhe |
|-------|---------|
| Local | `lib/db/prisma-tx.ts` — tipo `PrismaTx`; sequência/regras fiscais e emissões usam `PrismaTx` sem cast. |

---

## Baixo

### SEC-006 — Cookies `secure` só em `NODE_ENV=production`

| Campo | Detalhe |
|-------|---------|
| Local | `frontend/src/lib/auth/edge-cookies.ts` |
| Nota | Aceitável para dev local; em staging HTTPS usar `NODE_ENV=production` ou flag dedicada. |

### SEC-007 — `dangerouslySetInnerHTML` em chart (shadcn)

| Campo | Detalhe |
|-------|---------|
| Local | `frontend/src/components/ui/chart.tsx` |
| Nota | CSS de tema; risco baixo se conteúdo não for user-controlled. |

---

## Pontos positivos

- **Multi-tenancy:** rotas fiscais/produtos/pedidos usam `tenantIdFromRequest` + filtro Prisma.
- **Auth:** verificação de `tokenVersion`, tipo `access`, rate limit em login/register/reset.
- **Validação:** Zod nas rotas; segredos com tamanho mínimo em produção (`requireJwtSecret`, `requirePasswordPepper`).
- **XML:** `xmlEscape` em `nfe-xml`; tributos via `engine` persistido.
- **Modularização:** `fiscal-core`, `nfe-xml`, plugins por contexto Fastify.

---

## Plano de follow-up (prioridade)

1. ~~CORS restrito~~ (feito)
2. ~~Rate limit lookup~~ (feito)
3. ~~`@fastify/helmet` no backend~~ (feito)
4. ~~Mover `/lookup/*` para API autenticada~~ (feito)
5. Backfill `xml_autorizado` + remover fallback no frontend
6. ~~Tipagem forte de transaction client~~ (feito — `PrismaTx`)

---

## Referências de skills utilizadas

- `.agents/skills/security-best-practices/SKILL.md`
- `.agents/skills/security-best-practices/references/javascript-typescript-nextjs-web-server-security.md`
- `.claude/skills/best-practices/SKILL.md`
- `.claude/skills/coding-guidelines/SKILL.md`

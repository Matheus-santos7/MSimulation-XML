# Spec: README portal + docs GitHub-ready

## Objective

Deixar o monorepo compartilhável no GitHub como **vitrine profissional** (recrutador/tech lead primeiro; dev depois; OSS como higiene).

**Entregáveis:**
1. README raiz “portal” enxuto (~150–200 linhas)
2. Migração de conteúdo profundo para `backend/README.md` e `frontend/README.md`
3. `LICENSE` (MIT)
4. `CONTRIBUTING.md` (leve, PT)

**Sucesso:**
- Em ~30s: o quê + stack + 1 diferencial
- Quick Start alinhado a `package.json`
- Links internos válidos; zero secrets reais
- Root ≤ ~200 linhas

## Tech Stack (documentado, não alterado)

Monorepo pnpm · Fastify 5 + Prisma + PostgreSQL · Next.js 15 · packages `fiscal-core` / `nfe-xml` · Docker Compose (Postgres + validador MCP opcional)

## Commands (fonte da verdade: raiz `package.json`)

| Comando | Descrição |
|---------|-----------|
| `pnpm install` | Instalar workspaces |
| `pnpm db:setup` | Docker up + migrate deploy |
| `pnpm docker:up` / `docker:down` / `docker:reset` / `docker:logs` | Compose |
| `pnpm dev` | Backend + frontend |
| `pnpm dev:backend` / `pnpm dev:frontend` | Pacotes isolados |
| `pnpm build` | Packages + frontend + backend |
| `pnpm test:backend` / `test:fiscal-core` / `test:nfe-xml` | Testes |
| `pnpm lint` / `pnpm format` | Qualidade |

## Project Structure (docs)

```
README.md                 → portal (~150–200 linhas)
LICENSE                   → MIT
CONTRIBUTING.md           → onboarding + PR + secrets
backend/README.md         → API, CA/DDD, fluxos, validador MCP, packages
frontend/README.md        → thin client, rotas, padrões, setup
docs/specs/               → esta SPEC
backend/docs/fiscal/      → regras CAT 31 / MOC (já existentes)
.env.example              → já existem (raiz, backend, frontend) — só validar
```

## Code Style (docs)

- PT principal; 1 parágrafo EN no topo do README raiz
- Sem template de secrets reais — só placeholders / referência a `.env.example`
- Nome do diretório do clone: `msimulation-xml` (não `msedit-xml`)
- Links relativos Markdown; não inventar assets inexistentes (ex.: `docs/assets/` não existe)

## Testing Strategy (verificação desta mudança)

Não há testes automatizados de Markdown. Verificar manualmente:
1. Todo comando citado no README existe em `package.json` (raiz ou package)
2. Todo link relativo resolve para ficheiro/pasta existente
3. Grep anti-secrets em docs novos (`AKIA`, `sk_live`, private keys, etc.)
4. `wc -l README.md` ∈ [150, 220] (tolerância pequena)

## Boundaries

- **Always:** Comandos = package.json; aviso educacional SEFAZ; placeholders em env
- **Ask first:** Mudar LICENSE para não-MIT; apagar conteúdo sem migrar; ADRs novos
- **Never:** Commitar `.env` reais, certificados, dados de cliente; inventar logo/path quebrado; alterar código de produto nesta SPEC

## Migration map (root → destino)

| Conteúdo atual no root | Destino |
|------------------------|---------|
| Hook, quick start, monorepo overview, scripts tabela, stack resumida | **Root** (enxuto) |
| Guia do estagiário + checklist PR | **CONTRIBUTING.md** |
| Problemas comuns (API/DB/MCP) | **backend/README.md** (+ 1–2 linhas frontend no FE) |
| Arquitetura backend, módulos, multi-tenant, auth | **backend/README.md** (já parcialmente lá; completar o que faltar) |
| Packages fiscal-core / nfe-xml + pipeline XML | **backend/README.md** (consumidor) |
| Fluxos de negócio + fluxo HTTP | **backend/README.md** |
| Validador MCP (secção 5 completa) | **backend/README.md** |
| Frontend rotas, padrões, thin client, diagramas FE | **frontend/README.md** |
| Docs fiscais CAT31/MOC | Manter links → `backend/docs/fiscal/` |

## Success Criteria

- [ ] `LICENSE` MIT presente
- [ ] `CONTRIBUTING.md` presente (PT, leve)
- [ ] README raiz ~150–200 linhas, EN blurb + PT, portal links
- [ ] `backend/README.md` contém fluxos + MCP (ou equivalente migrado)
- [ ] `frontend/README.md` útil para setup + estrutura (não ~24 linhas)
- [ ] Comandos = package.json; links OK; sem secrets

## Open Questions

Nenhuma — assumptions aprovadas implicitamente (“SPEC aprovada” + implemente).

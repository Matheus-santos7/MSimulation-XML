# Spec: Convenções do monorepo (baseline)

> **STATUS: APPROVED** (2026-07-25)  
> Tipo: SPEC de **convenções / baseline** (não é feature fiscal).  
> Fonte: layout e scripts atuais do repo (`package.json`, `CONTRIBUTING.md`, packages).  
> Specs de feature continuam em `docs/specs/<feature>.md` e prevalecem no escopo delas.

---

## ASSUMPTIONS (aprovadas — opção A)

1. Escopo = documentar/alinhar a estrutura e convenções **como devem permanecer**, sem redesign do monorepo.
2. As seis áreas do template `spec-driven-development` estão cobertas (objective, commands, structure, style, testing, boundaries).
3. Artefato em `docs/specs/monorepo-conventions.md`; zero código nesta fase.
4. Commands/Structure espelham o monorepo atual (`pnpm`, `frontend/`, `backend/`, `packages/*`).
5. Features fiscais novas **não** entram aqui — usam SPEC própria + `docs/intent/` quando necessário.

---

## Objective

Dar a humanos e agentes uma **fonte única de verdade** sobre onde colocar código, como rodar o projeto, estilo, testes e limites operacionais — para que mudanças futuras:

1. Caiam nos pacotes/camadas corretos (thin client; fiscal no backend/packages).
2. Usem os mesmos comandos de verify (`test` / `lint` / `tsc`).
3. Sigam o fluxo gated: intent → SPEC → plan/tasks → implement (sem commit/push sem OK humano).

### User stories

- Como contribuinte, sei onde criar um use case, um builder XML ou um componente UI sem adivinhar.
- Como agente, sei quais pastas tocar e o que pedir aprovação antes de alterar.
- Como revisor, rejeito PRs que coloquem lógica fiscal no frontend ou misturem domain com Fastify/Prisma.

### Acceptance criteria (desta SPEC)

1. Documento cobre as **seis** áreas + Success Criteria + Out of scope.
2. Humano marca **STATUS: APPROVED** (ou rejeita com correções).
3. Novas specs de feature **referenciam** esta baseline em Tech Stack / Commands / Structure (“idem `monorepo-conventions`”) em vez de reescrever o monorepo.
4. Nenhum redesign de pastas/pacotes é proposto ou executado por esta SPEC.

---

## Tech Stack

| Camada | Stack |
|--------|--------|
| Monorepo | pnpm workspaces 9 (`pnpm-workspace.yaml`) |
| Frontend | Next.js (App Router), React, TypeScript, ESLint, shadcn/Radix |
| Backend | Fastify 5, Zod, Prisma 7 + PostgreSQL, TypeScript ESM |
| Domínio fiscal puro | `@msimulation-xml/fiscal-core` |
| Geração XML NF-e | `@msimulation-xml/nfe-xml` (depende de `fiscal-core`) |
| Infra local | Docker Compose (Postgres), `render.yaml` / Vercel para deploy |
| Agent skills | `.cursor/skills/` (canônico, commitado) + regra `.cursor/rules/agent-skills.mdc`; `.agents/skills/` = sync local gitignored (`rsync` após `npx skills add` — ver ready-prompts) |

---

## Commands

```bash
# Setup
pnpm install
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local   # opcional
pnpm db:setup                                 # docker up + migrate deploy

# Dev (API :3001 + UI :3000)
pnpm dev
pnpm dev:backend
pnpm dev:frontend

# Build (ordem: packages → apps)
pnpm build
pnpm --filter @msimulation-xml/fiscal-core build
pnpm --filter @msimulation-xml/nfe-xml build
pnpm --filter @msimulation-xml/backend build
pnpm --filter @msimulation-xml/frontend build

# Test
pnpm test:backend                             # fiscal-core + nfe-xml + backend
pnpm test:fiscal-core
pnpm test:nfe-xml
pnpm --filter @msimulation-xml/frontend test
pnpm --filter @msimulation-xml/backend test

# Lint / types / format
pnpm lint                                     # frontend ESLint
pnpm --filter @msimulation-xml/frontend typecheck
pnpm --filter @msimulation-xml/backend exec tsc --noEmit
pnpm format                                   # prettier --write .

# Docker
pnpm docker:up
pnpm docker:down
pnpm docker:logs
pnpm docker:reset                             # down -v (destrutivo — Ask first)
```

**Verify mínimo antes de pedir commit** (espelha `CONTRIBUTING.md`):

```bash
pnpm test:backend
pnpm lint
pnpm --filter @msimulation-xml/backend exec tsc --noEmit
```

---

## Project Structure

```text
msimulation-xml/
├── frontend/                 → Next.js UI (thin client)
│   └── src/
│       ├── app/              → rotas App Router (grupos (app)/(auth)/(onboarding), api BFF)
│       ├── components/       → UI
│       ├── hooks/
│       └── lib/              → helpers UI/HTTP (sem motor fiscal)
├── backend/                  → Fastify API + Prisma
│   ├── prisma/               → schema + migrations
│   ├── docs/fiscal/          → MOC / CAT 31 / regras fiscais de domínio
│   └── src/
│       ├── modules/<bc>/     → bounded contexts (auth, catalog, tax, remessas, sales, …)
│       │   ├── domain/       → entidades/serviços puros (sem Fastify/Prisma)
│       │   ├── application/  → use cases / services de aplicação
│       │   ├── infrastructure/
│       │   └── presentation/ → controllers / mappers HTTP
│       ├── lib/              → shared infra (auth, http errors, …)
│       └── plugins/
├── packages/
│   ├── fiscal-core/          → lógica fiscal pura + testes colocalizados (*.test.ts)
│   └── nfe-xml/              → builders/serializer XML NF-e + testes
├── docs/
│   ├── specs/                → SPECs (feature + esta baseline)
│   ├── intent/               → intents confirmados antes da SPEC
│   └── agent-skills-ready-prompts.md
├── tasks/                    → plan/todo por feature (arquivos nomeados)
├── .cursor/skills/           → skills de workflow (canônico no git; Cursor lê daqui)
├── .cursor/rules/            → regras sempre-on (skills + fiscal)
├── .agents/skills/           → cópia local (gitignored); sync → `.cursor/skills/` via rsync
├── infra/                    → proxies/serviços auxiliares
└── scripts/                  → utilitários de ops (não domínio)
```

### Onde colocar o quê

| Tipo de mudança | Onde |
|-----------------|------|
| Regra tributária / CFOP / CST / arredondamento | `packages/fiscal-core` e/ou `backend/.../tax` (+ doc em `backend/docs/fiscal/`) |
| Forma do XML (`<det>`, `<NFref>`, tags) | `packages/nfe-xml` |
| Orquestração HTTP / persistência / cadeia ML | `backend/src/modules/<bc>` |
| UI / wizard / lista NF-e | `frontend/src` (chama API; não recalcula imposto) |
| Contrato de feature (antes do código) | `docs/intent/` → `docs/specs/` → `tasks/` |
| Schema DB | `backend/prisma` (**Ask first**) |

---

## Code Style

- **Idioma do código:** inglês; termos fiscais BR permanecem (`NFe`, `CTe`, `CFOP`, `CST`, `xPed`, `infCpl`).
- **Módulos:** ESM (`"type": "module"`); imports relativos com sufixo `.js` onde o package exige.
- **Formatação:** Prettier — `printWidth: 100`, `semi: true`, `singleQuote: false`, `trailingComma: "all"`.
- **Backend:** Clean Architecture — `domain` não importa Fastify/Prisma.
- **Frontend:** thin client — validação de formulário OK; motor fiscal **não**.
- **Fiscal:** sem hardcode de alíquotas; arredondamento comercial 2 casas por item antes de somar totais (regra `.cursor/rules/especialista-fiscal.mdc`).
- **Commits:** Conventional Commits (`feat(fiscal):`, `fix(ui):`, …); commit/push só com autorização humana explícita.

### Exemplo (bom)

```ts
/**
 * Chaves de remessa distintas (44 dígitos), na ordem de primeira aparição.
 * Usado no retorno simbólico/físico multi-remessa → N blocos `<NFref>`.
 */
export function distinctRemessaChaves(
  lines: ReadonlyArray<{ remessaChave: string }>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const k = String(line.remessaChave ?? "").replace(/\D/g, "");
    if (k.length === 44 && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
```

### Exemplo (ruim)

```ts
// ❌ lógica fiscal no frontend
export function calcIcms(vProd: number) {
  return Math.round(vProd * 0.18 * 100) / 100; // alíquota chumbada + arredondamento no lugar errado
}
```

---

## Testing Strategy

| Nível | Onde | Framework | Quando |
|-------|------|-----------|--------|
| Unit (puro) | `packages/fiscal-core/**/*.test.ts`, `packages/nfe-xml/**/*.test.ts` | `node:test` + `tsx` | Toda mudança de regra/XML |
| Unit / domain backend | `backend/src/modules/**/**/*.test.ts` (colocalizado) | idem | Use cases, FIFO, tax engine, mappers |
| Unit UI leve | `frontend/src/lib/**/*.test.ts` | idem | Helpers/rotas BFF — não e2e browser por padrão |
| Typecheck | `tsc --noEmit` backend/frontend | — | Antes de commit |
| Lint | `pnpm lint` (frontend) | ESLint | Antes de commit |
| Smoke homologação | checklist na SPEC da feature | manual | Pós-implement; humano |

**Convenções:**

- Teste **colocalizado** ao módulo (`foo.ts` + `foo.test.ts`).
- Feature fiscal: red → green nos packages **antes** de orquestração backend/UI.
- Coverage formal % **não** é gate global; regressões nos testes listados nos `package.json` **são** gate.
- Browser e2e / DevTools só quando a SPEC da feature pedir (`browser-testing-with-devtools`).

---

## Boundaries

### Always

- Rodar o verify mínimo relevante ao pacote tocado antes de pedir commit.
- Seguir thin client + Clean Architecture.
- Consultar `backend/docs/fiscal/` (e regra especialista-fiscal) em mudanças tributárias/XML.
- Surface ASSUMPTIONS; gated workflow (SPEC → plan → tasks → implement).
- Atualizar SPEC de feature quando decisões mudarem.

### Ask first

- Migration / mudança de schema Prisma.
- Nova dependência runtime ou troca major de lib.
- Reorganizar pastas/pacotes do monorepo (fora desta baseline).
- Alterar CI (`.github/workflows`), Docker, `render.yaml`, secrets/env de produção.
- Commit, push, PR merge, `docker:reset` / drop de volume.
- Expandir escopo além da SPEC APPROVED da feature.

### Never

- Commitar `.env`, certificados, dumps ou dados reais de clientes.
- Colocar motor fiscal / geração XML no frontend.
- Importar Fastify/Prisma em `domain/`.
- Hardcodar alíquotas (`pICMS = 18`, etc.) no código.
- Remover testes falhando para “ficar verde” sem aprovação.
- Afirmar validade jurídica SEFAZ / usar `tpAmb=1` como se fosse produção real (produto é simulador educacional).

---

## Success Criteria

1. Humano aprova esta SPEC (`STATUS: APPROVED` + data). ✅ 2026-07-25
2. Agentes/humanos usam este arquivo como referência padrão de Commands/Structure/Style/Testing/Boundaries.
3. Specs de feature novas apontam para cá em vez de duplicar o monorepo.
4. Nenhuma mudança de código ou layout de pastas foi feita **só** por causa desta SPEC.

---

## Out of scope

- Redesign do monorepo (mover `frontend/` para `apps/`, extrair novos packages, etc.).
- Upgrade de Next.js / Prisma / Fastify (SPEC própria + `source-driven-development`).
- Qualquer feature fiscal (CFOP, ST, infCpl, multi-remessa, conferência inbound, …).
- Política de coverage % obrigatório ou suite e2e completa.

---

## Open Questions

1. ~~Link em CONTRIBUTING/README?~~ → **SIM** (2026-07-25) — Tasks C–D do plan.
2. ~~Path canônico de skills?~~ → **`.cursor/skills/`** (2026-07-25). `.agents/skills/` permanece sync local gitignored.

Nenhuma pergunta bloqueante aberta.

# Unified Code Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED SUB-SKILL:** unified-code-review (post-task + pre-merge gates) — aplicar este plano com os gates desta skill após cada task abaixo.

**Goal:** Orquestrar bugbot → code-reviewer → output caveman em gates automáticos pós-task e pré-merge, versionado no repo msedit-xml.

**Architecture:** Skill `.cursor/skills/unified-code-review/SKILL.md` referencia 4 prompts em `docs/superpowers/review/`; artefatos persistidos em `docs/superpowers/reviews/`. Integra com `subagent-driven-development` sem fork do plugin superpowers.

**Tech Stack:** Cursor skills/subagents (`bugbot`, `code-reviewer`), Markdown, Git SHAs

**Spec:** `docs/superpowers/specs/2026-06-23-unified-code-review-design.md`

---

## File map (antes das tasks)

| Arquivo | Responsabilidade |
|---------|------------------|
| `.cursor/skills/unified-code-review/SKILL.md` | Orquestrador: quando rodar, pipeline, gates, fix loop |
| `docs/superpowers/review/fiscal-ca-checklist.md` | Checklist fiscal + CA compartilhado |
| `docs/superpowers/review/bugbot-stage.md` | Prompt/instruções stage 1 |
| `docs/superpowers/review/code-reviewer-stage.md` | Prompt/instruções stage 2 |
| `docs/superpowers/review/caveman-output.md` | Regras formatação stage 3 |
| `docs/superpowers/reviews/.gitkeep` | Mantém diretório de artefatos |
| `docs/superpowers/reviews/_artifact-template.md` | Template de artefato de review |
| `docs/superpowers/writing-plans-overlay.md` | Nota local sobre header unified-code-review |
| `docs/superpowers/plans/2026-06-23-unified-code-review.md` | Este plano (piloto de referência) |

---

### Task 1: Diretórios base

**Files:**
- Create: `docs/superpowers/review/`
- Create: `docs/superpowers/reviews/.gitkeep`
- Create: `.cursor/skills/unified-code-review/`

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p docs/superpowers/review
mkdir -p docs/superpowers/reviews
mkdir -p .cursor/skills/unified-code-review
touch docs/superpowers/reviews/.gitkeep
```

- [ ] **Step 2: Verificar**

```bash
test -d docs/superpowers/review && test -d docs/superpowers/reviews && test -d .cursor/skills/unified-code-review && echo OK
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/review docs/superpowers/reviews/.gitkeep .cursor/skills/unified-code-review
git commit -m "chore(superpowers): scaffold unified-code-review directories"
```

---

### Task 2: Checklist fiscal + CA

**Files:**
- Create: `docs/superpowers/review/fiscal-ca-checklist.md`

- [ ] **Step 1: Escrever checklist**

Criar `docs/superpowers/review/fiscal-ca-checklist.md` com conteúdo:

```markdown
# Fiscal + Clean Architecture Checklist (msedit-xml)

Use este checklist nos stages **bugbot** e **code-reviewer** quando o diff tocar backend fiscal, XML, impostos ou frontend com lógica de domínio.

## Clean Architecture / DDD

- [ ] `domain/` não importa Fastify, Prisma nem libs externas
- [ ] `application/` importa apenas `domain/`
- [ ] Prisma existe somente em `infrastructure/prisma/`
- [ ] Controllers em `presentation/` são burros: HTTP in → use case → HTTP out
- [ ] Regra de negócio não vive em routes/services legados (`src/routes`, `src/services`)
- [ ] Nomes de arquivos em `kebab-case` com sufixo de camada (`*.use-case.ts`, `*.controller.ts`)

## XML (regra 04-refactory-xml)

- [ ] XML montado como objeto JS/TS puro; serialização só no final
- [ ] Proibido template strings para tags (`<tag>${valor}</tag>`)
- [ ] Funções pequenas por node (`buildIde`, `buildDest`, etc.)
- [ ] Cálculo de impostos em resolvers isolados, não no builder XML

## Matemática fiscal (MOC / rejeições SEFAZ)

- [ ] Valores por item arredondados comercialmente para 2 casas **antes** de somar totais
- [ ] Bloco `<total>` é reduce dos itens já arredondados (não recalcular imposto no total)
- [ ] `vNF = vProd - vDesc + vOutro + vSeg + vFrete + vST + vIPI + vII`
- [ ] Se `vBC` ou alíquota zerada → valor do imposto zerado (não gerar `vICMS` > 0)
- [ ] FCP em tags exclusivas (`pFCP`, `vFCP`); nunca embutido em `pICMS`
- [ ] CST/CSOSN coerente com regime tributário e CFOP
- [ ] DIFAL obrigatório: interestadual (CFOP 6xxx) + `indFinal=1` + `indIEDest=9`
- [ ] Devoluções: espelhar nota origem; IPI devolvido em `vIPIDevol`

## Frontend thin client

- [ ] Frontend não importa `xlsx` nem faz parse de planilhas
- [ ] Frontend não monta/assina XML
- [ ] Frontend não chama APIs externas (ViaCEP, SEFAZ, ML) direto — só `/api/...`
- [ ] Validações de domínio vêm da API (`domain-errors`), não inventadas no browser

## Severidade sugerida

| Finding | Severidade |
|---------|------------|
| Math fiscal errado que gera rejeição SEFAZ | Critical |
| Template string XML / layer violation grave | Critical |
| Test gap em resolver fiscal | Important |
| Controller com if/else de negócio | Important |
| Naming/style | Minor |
```

- [ ] **Step 2: Verificar arquivo**

```bash
test -f docs/superpowers/review/fiscal-ca-checklist.md && wc -l docs/superpowers/review/fiscal-ca-checklist.md
```

Expected: linha count > 40

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/review/fiscal-ca-checklist.md
git commit -m "docs(superpowers): add fiscal-ca checklist for unified code review"
```

---

### Task 3: Stage bugbot

**Files:**
- Create: `docs/superpowers/review/bugbot-stage.md`

- [ ] **Step 1: Escrever prompt stage**

Criar `docs/superpowers/review/bugbot-stage.md`:

```markdown
# Stage 1 — Bugbot

Primeiro stage do pipeline `unified-code-review`. Foco: bugs, regressões, security óbvio, edge cases.

## Subagent

- `subagent_type`: `bugbot`
- `readonly`: `true`
- `run_in_background`: `false`
- `description`: `"Bugbot (unified-code-review stage 1)"`

## Prompt shape

```text
Full Repository Path: /Users/matheus/Documents/msedit-xml
Diff: <ver tabela abaixo>
Change Description: <obrigatório se Diff = natural language>
Custom Instructions: Review for runtime bugs, regressions, null/edge cases, and security issues. Apply docs/superpowers/review/fiscal-ca-checklist.md when diff touches backend/src/modules/**/tax*, **/xml/**, **/fiscal-*, or frontend fiscal logic.
```

## Diff por gate

| Gate | Diff value | Notas |
|------|------------|-------|
| post-task | Omitir `Diff: branch changes`. Usar SHAs: informar ao subagent `Review git range BASE_SHA..HEAD_SHA` na Custom Instructions | BASE = commit antes da task; HEAD = HEAD atual |
| pre-merge | `branch changes` | Base branch default `main` |

## Retry

Se diff não computar: retry 1× com `Diff: natural language` + `Change Description` (um bloco por arquivo).

## Output esperado

Lista de findings com severidade. Mapear para:

- **Critical:** runtime break, data loss, exploit
- **Important:** race, null não tratado, validação ausente
- **Minor:** style, nit

## Gate

Critical ou Important → stage BLOCKED → fix loop (max 3) → re-run só bugbot.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/review/bugbot-stage.md
git commit -m "docs(superpowers): add bugbot stage prompt for unified code review"
```

---

### Task 4: Stage code-reviewer

**Files:**
- Create: `docs/superpowers/review/code-reviewer-stage.md`

- [ ] **Step 1: Escrever prompt stage**

Criar `docs/superpowers/review/code-reviewer-stage.md`:

```markdown
# Stage 2 — Code Reviewer

Segundo stage. Só roda se bugbot PASS. Foco: plan compliance, arquitetura, testes.

## Subagent

- `subagent_type`: `code-reviewer`
- `readonly`: `true`
- `run_in_background`: `false`
- `description`: `"Code reviewer (unified-code-review stage 2)"`

## Template base

Usar placeholders de `requesting-code-review/code-reviewer.md`:

| Placeholder | Valor |
|-------------|-------|
| WHAT_WAS_IMPLEMENTED | Resumo da task N ou "full branch pre-merge" |
| PLAN_OR_REQUIREMENTS | Path do plan + task N (ex: `docs/superpowers/plans/foo.md` Task 3) |
| BASE_SHA | SHA base do gate |
| HEAD_SHA | SHA head do gate |
| DESCRIPTION | 1-2 frases do que mudou |

## Checklist adicional (além do template superpowers)

1. Ler `docs/superpowers/review/fiscal-ca-checklist.md` e aplicar itens relevantes ao diff
2. Task requirements do plan atendidos?
3. Arquivos novos seguem estrutura do plan?
4. Testes cobrem lógica real (não só mocks vazios)?

## Severidade

- **Critical:** fora do plan, layer violation grave, math fiscal errado
- **Important:** test gap, error handling fraco, scope creep
- **Minor:** docs, naming

## Gate

Critical ou Important → BLOCKED → fix loop (max 3) → re-run só code-reviewer.

## Retry

Timeout ou output vazio: retry 1×. Segunda falha → escalar humano.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/review/code-reviewer-stage.md
git commit -m "docs(superpowers): add code-reviewer stage prompt for unified code review"
```

---

### Task 5: Stage caveman output

**Files:**
- Create: `docs/superpowers/review/caveman-output.md`

- [ ] **Step 1: Escrever regras de formatação**

Criar `docs/superpowers/review/caveman-output.md`:

```markdown
# Stage 3 — Caveman Output (formatação)

Não é subagent. Agent pai formata findings de bugbot + code-reviewer.

## Input

- Raw findings dos stages 1 e 2
- Dedupe por `file:line` (manter severidade mais alta)

## Formato

`L<line>: <prefix> <problem>. <fix>.`

Prefixos:
- `🔴 bug:` — Critical
- `🟡 risk:` — Important
- `🔵 nit:` — Minor
- `❓ q:` — pergunta genuína

Multi-arquivo: `path/to/file.ts:L42: ...`

## Regras

- Uma linha por finding
- Sem "I noticed...", "maybe consider..."
- Manter nomes exatos de símbolos em backticks
- Security/CVE: parágrafo normal (exceção — não comprimir)

## Verdict block (append ao artefato)

```markdown
## Verdict
**Status:** PASS | BLOCKED
**Gate:** post-task-N | pre-merge
**Loops:** <n>
**Ready to proceed:** Yes | No — fix Critical/Important first
```

PASS somente se nenhum Critical/Important pendente.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/review/caveman-output.md
git commit -m "docs(superpowers): add caveman output rules for unified code review"
```

---

### Task 6: Skill orquestradora

**Files:**
- Create: `.cursor/skills/unified-code-review/SKILL.md`

- [ ] **Step 1: Escrever SKILL.md**

Criar `.cursor/skills/unified-code-review/SKILL.md`:

```markdown
---
name: unified-code-review
description: >
  Orquestra bugbot → code-reviewer → caveman output em gates pós-task e pré-merge.
  Use após cada task de implementation plan, antes de merge/PR, ou quando usuário pedir /review.
---

# Unified Code Review

Orquestrador de review para msedit-xml. Unifica `bugbot`, `code-reviewer` e formatação `caveman-review`.

**Spec:** `docs/superpowers/specs/2026-06-23-unified-code-review-design.md`

## When to use

1. **post-task gate** — após implementer commitar task N e spec reviewer PASS; antes de marcar task done
2. **pre-merge gate** — após última task; antes de `finishing-a-development-branch` ou `gh pr create`
3. **On demand** — usuário pede `/review`, `/unified-code-review`, ou "review this"

## Pipeline (sequencial)

```
bugbot → (fix loop se BLOCKED) → code-reviewer → (fix loop se BLOCKED) → caveman format → artefato
```

Ler prompts em:
- `docs/superpowers/review/bugbot-stage.md`
- `docs/superpowers/review/code-reviewer-stage.md`
- `docs/superpowers/review/caveman-output.md`
- `docs/superpowers/review/fiscal-ca-checklist.md`

## SHA resolution

**post-task:**
```bash
BASE_SHA=<commit before task started>
HEAD_SHA=$(git rev-parse HEAD)
```

**pre-merge:**
```bash
BASE_SHA=$(git merge-base HEAD main)
HEAD_SHA=$(git rev-parse HEAD)
```

Abort se HEAD não tiver commit da task.

## Gate rules

- **BLOCKED** se Critical ou Important em qualquer stage
- **Minor** nunca bloqueia
- Fix loop: agent pai corrige → re-run **só** stage que falhou
- Max **3 loops** por gate; loop 3 ainda BLOCKED → escalar humano

## Artifact

Salvar em `docs/superpowers/reviews/`:
- post-task: `YYYY-MM-DD-<plan-slug>-task-N-review.md`
- pre-merge: `YYYY-MM-DD-<plan-slug>-pre-merge-review.md`

Usar template: `docs/superpowers/reviews/_artifact-template.md`

Commitar artefato após cada gate PASS.

## Integration with subagent-driven-development

Por task:
1. implementer → commit
2. spec reviewer (superpowers)
3. **unified-code-review post-task** ← this skill
4. mark task complete

Após última task:
1. **unified-code-review pre-merge**
2. finishing-a-development-branch (only if pre-merge PASS)

## Error handling

| Falha | Ação |
|-------|------|
| bugbot diff fail | retry natural language (1×) |
| code-reviewer empty | retry (1×) → escalar |
| empty diff post-task | WARN; PASS se spec reviewer OK |

## Do NOT

- Pular bugbot ou code-reviewer
- Avançar task com gate BLOCKED
- Criar PR sem pre-merge PASS
```

- [ ] **Step 2: Verificar frontmatter**

```bash
head -5 .cursor/skills/unified-code-review/SKILL.md
```

Expected: `name: unified-code-review` presente

- [ ] **Step 3: Commit**

```bash
git add .cursor/skills/unified-code-review/SKILL.md
git commit -m "feat(skills): add unified-code-review orchestrator skill"
```

---

### Task 7: Template de artefato

**Files:**
- Create: `docs/superpowers/reviews/_artifact-template.md`

- [ ] **Step 1: Escrever template**

```markdown
# Code Review Artifact

**Plan:** `docs/superpowers/plans/YYYY-MM-DD-<slug>.md`
**Task:** N | pre-merge
**Gate:** post-task-N | pre-merge
**BASE_SHA:** `<sha>`
**HEAD_SHA:** `<sha>`
**Timestamp:** YYYY-MM-DDTHH:mm:ssZ
**Loops:** 0

---

## Stage 1 — Bugbot (raw)

<!-- paste bugbot findings -->

## Stage 2 — Code Reviewer (raw)

<!-- paste code-reviewer findings -->

## Stage 3 — Caveman Summary

<!-- one line per issue, deduped -->

## Verdict

**Status:** PASS | BLOCKED
**Gate:** post-task-N | pre-merge
**Loops:** 0
**Ready to proceed:** Yes | No — fix Critical/Important first
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/reviews/_artifact-template.md
git commit -m "docs(superpowers): add code review artifact template"
```

---

### Task 8: Overlay writing-plans

**Files:**
- Create: `docs/superpowers/writing-plans-overlay.md`

- [ ] **Step 1: Documentar header obrigatório**

Criar `docs/superpowers/writing-plans-overlay.md`:

```markdown
# Writing Plans — Overlay local (msedit-xml)

Extensão do skill superpowers `writing-plans` para este repo.

## Header obrigatório em todo plan novo

Além do header padrão superpowers, incluir:

```markdown
> **REQUIRED SUB-SKILL:** unified-code-review (post-task + pre-merge gates)
```

## Execução

Ao implementar plans com `subagent-driven-development`:

1. implementer → commit
2. spec reviewer
3. **unified-code-review** post-task
4. mark task done

Após última task: **unified-code-review** pre-merge → só então merge/PR.

## Referências

- Spec: `docs/superpowers/specs/2026-06-23-unified-code-review-design.md`
- Skill: `.cursor/skills/unified-code-review/SKILL.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/writing-plans-overlay.md
git commit -m "docs(superpowers): add writing-plans overlay for unified-code-review"
```

---

### Task 9: Dry-run manual (validação)

**Files:**
- Nenhum arquivo novo — validação operacional

- [ ] **Step 1: Checklist de arquivos**

```bash
for f in \
  .cursor/skills/unified-code-review/SKILL.md \
  docs/superpowers/review/fiscal-ca-checklist.md \
  docs/superpowers/review/bugbot-stage.md \
  docs/superpowers/review/code-reviewer-stage.md \
  docs/superpowers/review/caveman-output.md \
  docs/superpowers/reviews/_artifact-template.md \
  docs/superpowers/writing-plans-overlay.md \
  docs/superpowers/specs/2026-06-23-unified-code-review-design.md
do
  test -f "$f" || echo "MISSING: $f"
done
echo "file check done"
```

Expected: nenhum `MISSING`

- [ ] **Step 2: Simular SHA resolution**

```bash
cd /Users/matheus/Documents/msedit-xml
git merge-base HEAD main
git rev-parse HEAD
```

Expected: dois SHAs válidos (40 chars hex)

- [ ] **Step 3: Registrar dry-run no artefato exemplo (opcional)**

Criar `docs/superpowers/reviews/2026-06-23-unified-code-review-dry-run.md` copiando `_artifact-template.md` com metadata preenchida e verdict `PASS` (sem findings — scaffold validation only).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/reviews/2026-06-23-unified-code-review-dry-run.md 2>/dev/null || true
git commit -m "docs(superpowers): add dry-run review artifact for unified-code-review" --allow-empty
```

---

## Spec coverage self-review

| Spec § | Task |
|--------|------|
| §4 Skill + gates | Task 6 |
| §5 Estrutura arquivos | Tasks 1, 7 |
| §6 Prompts | Tasks 2–5 |
| §7 Severidade/fix loop | Tasks 2–6 |
| §8 Erros operacionais | Tasks 3, 4, 6 |
| §9 Verdict template | Tasks 5, 7 |
| §10 writing-plans overlay | Task 8 |
| §11 Escopo v1 | Tasks 1–9 |
| §12 Critérios sucesso | Task 9 dry-run |

Sem placeholders TBD. Plano focado em docs/skills — sem código de aplicação.

---

## Verificação final

```bash
ls -la .cursor/skills/unified-code-review/
ls -la docs/superpowers/review/
ls -la docs/superpowers/reviews/
```

Expected: SKILL.md + 4 prompts + template + spec referenciável.

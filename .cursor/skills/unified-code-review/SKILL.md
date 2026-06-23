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

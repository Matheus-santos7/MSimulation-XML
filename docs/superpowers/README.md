# Superpowers (msedit-xml)

Workflow local de specs, plans e code review para agentes Cursor.

## Fluxos

| Tipo | Pasta | Exemplo |
|------|-------|---------|
| Design spec | `specs/` | `2026-06-23-unified-code-review-design.md` |
| Implementation plan | `plans/` | `2026-06-23-unified-code-review.md` |
| Review artifacts | `reviews/` | `YYYY-MM-DD-<slug>-task-N-review.md` |
| Review prompts | `review/` | `bugbot-stage.md`, `fiscal-ca-checklist.md` |

## Unified Code Review

Pipeline: **bugbot → code-reviewer → caveman output**

- **Skill:** `.cursor/skills/unified-code-review/SKILL.md`
- **Spec:** `specs/2026-06-23-unified-code-review-design.md`
- **Plans overlay:** `writing-plans-overlay.md` — todo plan novo inclui gate post-task + pré-merge

Gates automáticos após cada task (pós spec reviewer) e antes de merge/PR. Hard stop em Critical ou Important.

## Execução de plans

1. `writing-plans` → spec aprovada → plan em `plans/`
2. `subagent-driven-development` → implementer por task
3. `unified-code-review` post-task após cada task
4. `unified-code-review` pre-merge antes de PR

**Nota:** `unified-code-review` **substitui** o code quality reviewer (`requesting-code-review`) do `subagent-driven-development`. Manter apenas **spec reviewer** antes do gate.

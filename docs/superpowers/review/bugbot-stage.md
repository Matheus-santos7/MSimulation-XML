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

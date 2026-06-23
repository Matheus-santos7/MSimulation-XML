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

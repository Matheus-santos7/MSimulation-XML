# Stage 2 — Code Reviewer

Segundo stage. Só roda se bugbot PASS. Foco: plan compliance, arquitetura, testes.

## Subagent

- `subagent_type`: `code-reviewer`
- `readonly`: `true`
- `run_in_background`: `false`
- `description`: `"Code reviewer (unified-code-review stage 2)"`

## Prompt (inline — não depende de plugin externo)

```text
You are reviewing code changes for production readiness.

**Your task:**
1. Review {WHAT_WAS_IMPLEMENTED}
2. Compare against {PLAN_OR_REQUIREMENTS}
3. Check code quality, architecture, testing
4. Categorize issues by severity
5. Assess production readiness

## What Was Implemented
{DESCRIPTION}

## Requirements/Plan
{PLAN_OR_REQUIREMENTS}

## Git Range to Review
**Base:** {BASE_SHA}
**Head:** {HEAD_SHA}

Run:
git diff --stat {BASE_SHA}..{HEAD_SHA}
git diff {BASE_SHA}..{HEAD_SHA}

## Additional checklist (msedit-xml)
1. Read docs/superpowers/review/fiscal-ca-checklist.md — apply relevant items
2. Plan task requirements met?
3. New files match plan structure?
4. Tests cover real logic (not empty mocks)?

## Output Format
### Strengths
### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)
### Assessment
**Ready to merge?** [Yes/No/With fixes]
```

| Placeholder | Valor |
|-------------|-------|
| WHAT_WAS_IMPLEMENTED | Resumo da task N ou "full branch pre-merge" |
| PLAN_OR_REQUIREMENTS | Path do plan + task N |
| BASE_SHA | SHA base do gate |
| HEAD_SHA | SHA head do gate |
| DESCRIPTION | 1-2 frases do que mudou |

## Severidade

- **Critical:** fora do plan, layer violation grave, math fiscal errado
- **Important:** test gap, error handling fraco, scope creep
- **Minor:** docs, naming

## Gate

Critical ou Important → BLOCKED → fix loop (max 3) → re-run só code-reviewer.

## Retry

Timeout ou output vazio: retry 1×. Segunda falha → escalar humano.

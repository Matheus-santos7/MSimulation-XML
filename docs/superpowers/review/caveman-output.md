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

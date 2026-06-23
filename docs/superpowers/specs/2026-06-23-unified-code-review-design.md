# Unified Code Review — Design Spec

**Data:** 2026-06-23  
**Status:** Aprovado (aguardando review escrito)  
**Escopo:** Workflow superpowers + skills Cursor (sem CI)  
**Relacionado:** `subagent-driven-development`, `requesting-code-review`, `review-bugbot`, `caveman-review`

## 1. Objetivo

Unificar três ferramentas de review já disponíveis no ecossistema Cursor (`bugbot`, `code-reviewer`, `caveman-review`) em um **único fluxo documentado e orquestrado** para o projeto msedit-xml, com gates automáticos após cada task de implementation plan e antes de merge.

## 2. Problema atual

| Ferramenta | O que faz | Lacuna |
|------------|-----------|--------|
| `requesting-code-review` | Dispara `code-reviewer` com SHAs + template | Não inclui bugbot nem output caveman; checklist genérico |
| `review-bugbot` | Dispara `bugbot` com diff automático | Isolado; sem gate de arquitetura/plan |
| `caveman-review` | Formata comentários terse | Só estilo de output; não orquestra subagents |
| `subagent-driven-development` | Spec review + code-reviewer pós-task | Não inclui bugbot; sem checklist fiscal/CA do projeto |

Plans em `docs/superpowers/plans/` mencionam review entre tasks, mas não há spec formal de **quando**, **como** ou **critério de bloqueio**.

## 3. Decisões de produto (brainstorming)

| Decisão | Escolha |
|---------|---------|
| Objetivo | Unificar bugbot + code-reviewer + caveman-review |
| Trigger | Automático pós-task + pré-merge (agent dispara sozinho) |
| Pipeline | Sequencial: bugbot → code-reviewer → output caveman |
| Gate | Hard stop em Critical **ou** Important |
| Abordagem | Orquestrador modular (skill repo + prompts em `docs/superpowers/review/`) |

## 4. Arquitetura

### 4.1 Nome e entry point

**Skill:** `unified-code-review`  
**Localização:** `.cursor/skills/unified-code-review/SKILL.md`

Agent invoca quando:
- completa task de implementation plan;
- usuário pede `/review` ou equivalente;
- antes de `finishing-a-development-branch` ou `gh pr create`.

### 4.2 Gates

| Gate | Quando | Diff scope |
|------|--------|------------|
| **post-task** | Após implementer commitar task N; depois do spec reviewer; antes de marcar task done | `BASE_SHA` = commit antes da task; `HEAD_SHA` = HEAD atual |
| **pre-merge** | Após última task; antes de finalizar branch/PR | `BASE_SHA` = merge-base com `main`; `HEAD_SHA` = HEAD |

### 4.3 Pipeline (ambos os gates)

```
Task commitada
    → bugbot
        → Critical/Important? → fix loop → re-run bugbot
        → pass
    → code-reviewer
        → Critical/Important? → fix loop → re-run code-reviewer
        → pass
    → caveman-review (formatação, não subagent)
    → salvar artefato + verdict PASS
```

`caveman-review` **não** é subagent. É etapa de formatação aplicada pelo agent pai sobre findings consolidados.

### 4.4 Integração com subagent-driven-development

Ordem final por task:

1. implementer → commit
2. spec reviewer (mantido — superpowers existente)
3. **unified-code-review gate post-task** (novo)
4. mark task complete

Após última task:

1. unified-code-review gate **pre-merge**
2. `finishing-a-development-branch` (somente se pre-merge PASS)

## 5. Estrutura de arquivos

```
.cursor/skills/unified-code-review/
└── SKILL.md                         # orquestrador

docs/superpowers/
├── review/
│   ├── bugbot-stage.md              # prompt bugbot + scope diff
│   ├── code-reviewer-stage.md       # template superpowers + checklist msedit-xml
│   ├── caveman-output.md            # regras de formatação final
│   └── fiscal-ca-checklist.md       # checklist compartilhado fiscal + CA + XML
└── reviews/
    └── YYYY-MM-DD-<plan-slug>-task-N-review.md
    └── YYYY-MM-DD-<plan-slug>-pre-merge-review.md
```

### 5.1 Artefato de review

Cada gate gera markdown em `docs/superpowers/reviews/` com:

- **Metadata:** plan path, task N (se post-task), gate type, BASE_SHA, HEAD_SHA, timestamp
- **bugbot findings** (raw)
- **code-reviewer findings** (raw)
- **caveman summary** (1 linha por issue, deduplicado por file:line)
- **Verdict:** `PASS` | `BLOCKED`
- **fix loop count**

Artefatos são **commitados** no repo (audit trail; agent retoma contexto em sessões futuras).

## 6. Prompts por stage

### 6.1 `bugbot-stage.md`

- Reutiliza shape de `review-bugbot/SKILL.md` (`Full Repository Path`, `Diff`, `Change Description`, `Custom Instructions`).
- **post-task:** diff explícito via SHAs (não `branch changes`).
- **pre-merge:** `Diff: branch changes` contra `main`.
- **Custom Instructions:** referenciar `fiscal-ca-checklist.md` quando diff tocar `backend/src/modules/**/tax*`, `**/xml/**`, `**/fiscal-*`, `frontend/**` com lógica fiscal.

### 6.2 `code-reviewer-stage.md`

- Base: `requesting-code-review/code-reviewer.md` (placeholders `WHAT_WAS_IMPLEMENTED`, `PLAN_OR_REQUIREMENTS`, `BASE_SHA`, `HEAD_SHA`, `DESCRIPTION`).
- Checklist adicional msedit-xml:
  - Clean Architecture: violações de camada (`domain` não importa externo, Prisma só em `infrastructure`)
  - XML: objeto JS/TS puro + serializador; proibido template strings para tags
  - Impostos: lógica em resolvers isolados; arredondamento 2 casas antes de somar
  - Frontend thin client: sem parse XLSX/XML; sem APIs externas diretas
  - Plan compliance: requisitos da task N atendidos
- Referência cruzada: `fiscal-ca-checklist.md`

### 6.3 `caveman-output.md`

- Input: findings merged de bugbot + code-reviewer
- Dedupe por `file:line`
- Formato: `L42: 🔴 bug: ...` / `🟡 risk:` / `🔵 nit:` / `❓ q:`
- Exceção: findings security/CVE → parágrafo normal (não comprimir)

### 6.4 `fiscal-ca-checklist.md`

Checklist compartilhado referenciado por bugbot e code-reviewer:

- Arredondamento comercial 2 casas por item antes de somar totais
- `vNF` conforme fórmula Sefaz
- Bases zeradas → valores de imposto zerados
- FCP em tags exclusivas (não embutido em `pICMS`)
- CST/CSOSN pareados com regime e CFOP
- DIFAL quando interestadual + consumidor final + não contribuinte
- Controllers burros; regra de negócio em use cases/services

## 7. Severidade e gates

### 7.1 Mapping unificado

| Origem | Critical | Important | Minor |
|--------|----------|-----------|-------|
| bugbot | runtime break, data loss, security exploit | race, null não tratado, validação ausente | style, nit |
| code-reviewer | fora do plan, layer violation grave, math fiscal errado | test gap, error handling fraco, scope creep | docs, naming |

### 7.2 Regra de bloqueio

- **Critical ou Important** em qualquer stage → `BLOCKED`
- **Minor** nunca bloqueia; registrado no artefato; opcional TODO no plan

### 7.3 Fix loop

- Agent pai corrige (não há subagent de auto-fix em v1)
- Re-executa **apenas** o stage que falhou
- Máximo **3 loops** por gate por task
- Loop 3 ainda bloqueado → escalar humano; não avançar task nem merge

## 8. Erros operacionais

| Falha | Ação |
|-------|------|
| bugbot não computa diff | retry 1× com `Diff: natural language` + `Change Description` |
| code-reviewer timeout/empty | retry 1×; segunda falha → escalar humano |
| SHA inválido (sem commit) | abort gate; agent deve commitar antes |
| diff vazio pós-task | WARN no artefato; PASS se spec reviewer já aprovou e nada mudou |

## 9. Verdict final (template)

```markdown
## Verdict
**Status:** PASS | BLOCKED
**Gate:** post-task-N | pre-merge
**Loops:** 0
**Ready to proceed:** Yes | No — fix Critical/Important first
```

Pré-merge `PASS` é obrigatório antes de `finishing-a-development-branch` ou `gh pr create`.

## 10. Integração com writing-plans

Todo plan novo deve incluir no header:

```markdown
> **REQUIRED SUB-SKILL:** unified-code-review (post-task + pre-merge gates)
```

Atualizar documentação de referência em `writing-plans` (overlay local em `docs/superpowers/`, sem fork do plugin superpowers).

## 11. Escopo v1

### In scope

- Skill orquestradora `.cursor/skills/unified-code-review/SKILL.md`
- 4 arquivos em `docs/superpowers/review/`
- Diretório `docs/superpowers/reviews/` (com `.gitkeep` se vazio)
- 1 plan piloto atualizado como referência
- Nota no README ou doc superpowers sobre o fluxo

### Out of scope v1

- CI/GitHub Action automático
- Integração Bugbot SaaS (Cursor cloud)
- Subagent dedicado de auto-fix
- Review de PRs externos sem plan associado
- Otimização de skip de stages já PASS no mesmo SHA range (v2)

## 12. Critérios de sucesso

Agent executando plan piloto:

1. Dispara review automático após cada task (pós spec reviewer).
2. Bloqueia em Critical ou Important.
3. Gera artefato caveman em `docs/superpowers/reviews/`.
4. Só avança para pré-merge / PR com gate pre-merge PASS.
5. Após 3 loops sem resolução, escala para humano em vez de spin infinito.

## 13. Próximo passo

Após aprovação desta spec: invocar skill **writing-plans** para plano de implementação em `docs/superpowers/plans/2026-06-23-unified-code-review.md`.

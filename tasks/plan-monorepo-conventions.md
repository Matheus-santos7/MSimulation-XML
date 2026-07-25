# Implementation Plan: Convenções do monorepo (baseline)

> Spec: [`docs/specs/monorepo-conventions.md`](../docs/specs/monorepo-conventions.md) **APPROVED** (2026-07-25)  
> Todo: [`tasks/todo-monorepo-conventions.md`](./todo-monorepo-conventions.md)  
> **Gate:** Plan **APPROVED** → IMPLEMENT (2026-07-25). Tasks A–D feitas. Sem commit/push sem autorização.  
> **Nota de path:** skill pede `tasks/plan.md` / `todo.md`; neste repo usamos arquivos nomeados para **não** apagar o todo multi-remessa ainda aberto.

## Overview

Tornar a baseline APPROVED **descobrível e consistente** na documentação: fechar Open Questions da SPEC, alinhar path canônico das skills, e linkar `CONTRIBUTING.md` / `README.md`. **Zero** redesign de pastas, **zero** código de aplicação, **zero** migrations.

## ASSUMPTIONS (aprovadas 2026-07-25)

1. **Open Q1 = SIM** ✅ — parágrafo curto em `CONTRIBUTING.md` + menção no `README.md`.
2. **Open Q2 = `.cursor/skills/` canônico** ✅ — `.agents/skills/` = sync local gitignored.
3. Escopo = docs-only; Success Criteria #4 da SPEC permanece.
4. Não reescrever specs de feature antigas em massa.
5. Não commit/push até o humano pedir.

## Architecture Decisions

| Tema | Decisão | Por quê |
|------|---------|---------|
| Tipo de trabalho | Docs-only vertical slices | SPEC é baseline de convenções, não feature |
| Skills path | Canônico: `.cursor/skills/` | `.agents/` gitignored; ready-prompts + rule já usam `.cursor` |
| Discoverability | Links em CONTRIBUTING + README | Success Criteria #2–3 da SPEC |
| Arquivos de plan/todo | `plan-monorepo-conventions.md` + `todo-monorepo-conventions.md` | Preserva `todo.md` (multi-remessa smoke pendente) |
| Retrofit specs antigas | Fora de escopo | Critério #3 fala em specs **novas** |

## Dependency graph

```
A. Fechar Open Questions na SPEC (decisões humanas)
    │
B. Alinhar texto da SPEC (árvore + Tech Stack skills path)
    │
    ├── C. Link em CONTRIBUTING.md
    └── D. Link em README.md
            │
E. Checkpoint docs (grep paths + links resolvem)
```

C e D são **paralelos** após B.

## Task List

### Phase 1: Fechar decisões + consistência da SPEC

#### Task A: Registrar decisões das Open Questions
**Description:** Atualizar a seção Open Questions da SPEC com as decisões aprovadas (Q1 links, Q2 path skills) e marcar como resolvidas.  
**Acceptance:**
- [ ] Open Questions têm resposta explícita + data
- [ ] Nenhuma pergunta bloqueante permanece aberta nesta SPEC
**Verification:** Ler `docs/specs/monorepo-conventions.md` § Open Questions  
**Dependencies:** None (precisa OK humano nas ASSUMPTIONS 1–2)  
**Files:** `docs/specs/monorepo-conventions.md`  
**Estimated scope:** XS

#### Task B: Alinhar path de skills na SPEC
**Description:** Na árvore Project Structure e Tech Stack, documentar `.cursor/skills/` como canônico e `.agents/skills/` como sync local (gitignored), alinhado a `docs/agent-skills-ready-prompts.md`.  
**Acceptance:**
- [ ] SPEC não apresenta `.agents/skills/` como única fonte para agentes
- [ ] Menciona sync `rsync` / ready-prompts onde couber (1 frase)
**Verification:** `rg -n "agents/skills|cursor/skills" docs/specs/monorepo-conventions.md`  
**Dependencies:** Task A  
**Files:** `docs/specs/monorepo-conventions.md`  
**Estimated scope:** XS

### Checkpoint: SPEC consistente
- [ ] Open Questions fechadas
- [ ] Path skills coerente com ready-prompts + `.gitignore`
- [ ] Review humano antes de links externos à SPEC

### Phase 2: Discoverability

#### Task C: Link no CONTRIBUTING.md
**Description:** Adicionar seção curta (≤1 parágrafo + link) apontando para `docs/specs/monorepo-conventions.md` (estrutura, commands, boundaries).  
**Acceptance:**
- [ ] Link relativo funciona
- [ ] Não duplica a SPEC inteira — só ponte
**Verification:** Abrir CONTRIBUTING; link aponta para a SPEC  
**Dependencies:** Task B  
**Files:** `CONTRIBUTING.md`  
**Estimated scope:** XS

#### Task D: Link no README.md
**Description:** Mencionar a baseline (1 linha ou bullet) junto aos links de docs existentes (LICENSE / CONTRIBUTING / Backend / Frontend).  
**Acceptance:**
- [ ] README cita a SPEC com link relativo
- [ ] Tom permanece “simulador educacional” / sem redesign
**Verification:** Abrir README; link resolve  
**Dependencies:** Task B  
**Files:** `README.md`  
**Estimated scope:** XS

### Checkpoint: Complete
- [ ] Tasks A–D feitas (ou C–D canceladas se Q1 = NÃO)
- [ ] `rg monorepo-conventions docs CONTRIBUTING.md README.md` encontra ≥3 hits
- [ ] Nenhum arquivo de app/packages alterado
- [ ] Pronto para review; commit só com autorização humana

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sobrescrever `todo.md` multi-remessa | Med | Usar `todo-monorepo-conventions.md` |
| Documentar path errado (`.agents` vs `.cursor`) | Med | Seguir `.gitignore` + ready-prompts |
| Escopo creep (reorganizar monorepo) | High | Out of scope da SPEC; recusar |
| Duplicar SPEC no CONTRIBUTING | Low | Só link + 1 frase |

## Out of scope (reafirmar)

- Redesign de pastas/pacotes
- Código, testes automatizados novos, CI
- Retrofit em massa de specs de feature
- Commit/push sem pedido explícito

## Open Questions

1. ~~Q1 links~~ → **SIM** (2026-07-25)
2. ~~Q2 path skills~~ → **`.cursor/skills/`** (2026-07-25)
3. ~~Plan APPROVED → IMPLEMENT~~ → feito (2026-07-25); commit/push sob demanda.

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

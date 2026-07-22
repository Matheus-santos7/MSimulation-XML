# Agent Skills — Ready Prompts

Copy-paste prompts for Cursor Agent chats in this repo.  
Skills live under `.cursor/skills/`. Routing is always-on via `.cursor/rules/agent-skills.mdc`.

**Best practice:** name the skill(s) in the first message of a **new** chat. One concern per chat (spec chat ≠ implement chat).

---

## How invocation works

| Layer | Path | Role |
|-------|------|------|
| Always-on rule | `.cursor/rules/agent-skills.mdc` | Forces routing every request |
| Meta-skill | `.cursor/skills/using-agent-skills/SKILL.md` | Phase → skill map |
| Workflow skills | `.cursor/skills/<name>/SKILL.md` | Step-by-step process + verification |
| This file | `docs/agent-skills-ready-prompts.md` | Human copy-paste starters |

You do **not** need to paste `SKILL.md` contents. Saying the skill name is enough when the rule is active.

### Invocation patterns (best → good)

```text
# Best — explicit skills + gated workflow
Follow using-agent-skills, then: <skill-a> → <skill-b>.
Goal: …
Do not implement until I approve the SPEC / plan.

# Good — skill by name
Use test-driven-development for this change: …

# OK — intent only (rule should still route)
Fix the failing remessa tests.
```

### Universal prefix (prepend to any demand)

```text
Follow using-agent-skills. Pick and READ the matching skill(s) under .cursor/skills/ before acting. Surface ASSUMPTIONS. Verify before claiming done.
```

---

## 1. Session bootstrap

```text
Follow using-agent-skills + context-engineering.
Load project conventions from .cursor/rules/ and summarize which skills apply to my next tasks. Do not change code yet.
```

---

## 2. Clarify vague requests

```text
Follow interview-me.
Ask one question at a time until you are ~95% sure what I want and why. Do not plan or code yet.

My ask: <PASTE VAGUE REQUEST>
```

```text
Follow idea-refine.
Stress-test this idea with divergent options, then converge on one sharp concept. Do not implement.

Idea: <PASTE>
```

---

## 3. Spec before code (recommended for non-trivial work)

```text
Follow using-agent-skills → spec-driven-development.
Write a SPEC covering: objective, commands, structure, style, testing, boundaries.
List ASSUMPTIONS first. Stop for my approval. Do not implement.

Change: <WHAT>
```

```text
SPEC approved: <path or paste>.
Follow planning-and-task-breakdown.
Break into small verifiable tasks with checkboxes. Stop for approval before implementation.
```

---

## 4. Implement

```text
Follow incremental-implementation + test-driven-development.
Execute the approved plan task-by-task. Red → green → refactor per task. Touch only what the task requires.
```

```text
Follow source-driven-development + incremental-implementation.
Implement using current official docs for <library/framework>. Cite sources. No outdated patterns from memory.
```

```text
Follow frontend-ui-engineering + test-driven-development.
Build/update UI in frontend/ with accessibility and production quality. Match existing design system.
```

```text
Follow api-and-interface-design + source-driven-development.
Design/change the API contract first, then implement. Keep backend Clean Architecture boundaries.
```

---

## 5. Bugs and failures

```text
Follow debugging-and-error-recovery → test-driven-development.
Reproduce, find root cause, fix with a failing test first. No speculative rewrites.

Symptom: <ERROR / BEHAVIOR>
```

---

## 6. Review and simplify

```text
Follow code-review-and-quality.
Review this change across correctness, readability, security, performance, and tests. List findings by severity. Do not rewrite unless I ask.
```

```text
Follow code-simplification.
Simplify the recent change for clarity without changing behavior. Show before/after rationale.
```

```text
Follow security-and-hardening.
Threat-model and harden this change. Call out secrets, authz, and input validation risks.
```

```text
Follow performance-optimization.
Measure or cite evidence before optimizing. Scope: <page / API / query>.
```

---

## 7. Docs and GitHub-ready project

```text
Follow documentation-and-adrs.
Refactor the root README into a thin GitHub portal (~150–200 lines): quick start, commands, architecture links, contributing.
Move deep content to backend/README.md and frontend/README.md. List ASSUMPTIONS; stop for approval before edits.
```

```text
Follow documentation-and-adrs.
Add LICENSE, CONTRIBUTING.md, and any missing GitHub-share artifacts. Keep README links valid. No secrets.
```

```text
Follow documentation-and-adrs.
Write ADR-XXX for: <DECISION>. Use docs/decisions/ if that convention exists; otherwise propose the path first.
```

---

## 8. Upgrades and migrations

```text
Follow using-agent-skills, then:
1) source-driven-development
2) spec-driven-development
3) planning-and-task-breakdown
4) deprecation-and-migration

Upgrade <package> from <from> to <to> in this monorepo.
Read official upgrade guides. List breaking changes that affect THIS repo.
Deliver SPEC + task plan + verification commands. Do not implement until I approve.
```

### Example — Next.js 15 → 16.2

```text
Follow using-agent-skills, then:
source-driven-development → spec-driven-development → planning-and-task-breakdown → deprecation-and-migration.

Upgrade frontend Next.js 15.5.19 → 16.2.x (latest stable 16.2 on npm).
Cite the official Next.js upgrade guide. List ASSUMPTIONS and breaking changes for App Router, config, eslint-config-next, React, middleware/proxy.
Deliver SPEC + tasks + done criteria (install, typecheck, test, build). Do not implement until I approve.
```

After SPEC approval:

```text
SPEC approved.
Follow incremental-implementation + test-driven-development.
Execute task-by-task. On failure use debugging-and-error-recovery.
Finish with code-review-and-quality and a short changelog of dependency/API updates.
```

---

## 9. Git, CI, ship

```text
Follow git-workflow-and-versioning.
Create a clean commit for the staged work. Conventional message. Do not push unless I ask.
```

```text
Follow ci-cd-and-automation.
Fix or improve CI for this failure: <paste log / check name>.
```

```text
Follow shipping-and-launch.
Pre-launch checklist for: <environment>. Include rollback notes. Do not deploy unless I ask.
```

---

## 10. Full feature lifecycle (one message)

```text
Follow using-agent-skills lifecycle as needed:
interview-me (only if unclear) → spec-driven-development → planning-and-task-breakdown
→ source-driven-development (if framework) → incremental-implementation + test-driven-development
→ code-review-and-quality → documentation-and-adrs.

Feature: <WHAT>
Stop after SPEC for approval, then continue when I say "SPEC approved".
```

---

## Cheat sheet

| You want… | Prompt starter |
|-----------|----------------|
| Always route | `Follow using-agent-skills.` |
| Unclear ask | `Follow interview-me.` |
| Spec first | `Follow spec-driven-development. Do not implement.` |
| Implement | `Follow incremental-implementation + test-driven-development.` |
| Framework truth | `Follow source-driven-development.` |
| Upgrade | `Follow source-driven-development → deprecation-and-migration.` |
| Bug | `Follow debugging-and-error-recovery.` |
| Review | `Follow code-review-and-quality.` |
| Docs / README | `Follow documentation-and-adrs.` |
| Commit | `Follow git-workflow-and-versioning.` |

---

## Anti-patterns

| Avoid | Prefer |
|-------|--------|
| Pasting entire `SKILL.md` into chat | Name the skill; agent reads the file |
| Loading all 24 skills at once | 1–3 skills for the current phase |
| Spec + full implementation in one unscoped chat | Spec chat → approval → implement chat |
| "Just bump the version" on major upgrades | Spec + official upgrade guide first |
| Skipping verification | Run the skill's verification checklist |

---

## Update skills from upstream

```bash
npx skills add addyosmani/agent-skills -y
rsync -a .agents/skills/ .cursor/skills/
```

Lockfile: `skills-lock.json` (committed). Source copy in `.agents/` is gitignored; Cursor reads `.cursor/skills/`.

# Implementation Plan: README portal + GitHub docs

## Overview

Documentação pública enxuta: portal na raiz, profundidade nos packages, LICENSE + CONTRIBUTING. Sem mudança de código de produto.

## Architecture Decisions

- **Portal vs satélites:** root vende e aponta; backend/frontend detalham.
- **MCP e fluxos no backend:** operação e domínio fiscal não cabem no portal.
- **CONTRIBUTING absorve guia do estagiário:** evita inchamento do root.
- **Sem asset de logo inventado:** `docs/assets/` não existe — não referenciar.
- **MIT:** padrão portfolio/OSS da SPEC.

## Task List

### Phase 1: Legal + contrib
- [x] Task 1: LICENSE (MIT)
- [x] Task 2: CONTRIBUTING.md

### Checkpoint: Foundation
- [x] Ficheiros existem; sem secrets

### Phase 2: Package READMEs
- [x] Task 3: Migrar para backend/README.md
- [x] Task 4: Expandir frontend/README.md

### Checkpoint: Packages
- [x] Links internos dos packages OK

### Phase 3: Portal + verify
- [x] Task 5: Reescrever README.md raiz
- [x] Task 6: Verificar comandos, links, secrets

### Checkpoint: Complete
- [x] Critérios da SPEC satisfeitos

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Perda de conteúdo ao enxugar root | Med | Migration map na SPEC; mover antes de cortar |
| Backend README ficar enorme | Low | Aceitável — é o satélite certo |
| Link quebrado para docs/assets | Med | Remover referência inexistente |
| Comando inventado | High | Diff contra package.json |

## Open Questions

Nenhuma.

# Contributing — MSimulation XML

Obrigado pelo interesse. Este é um **simulador fiscal educacional** (homologação / sem validade SEFAZ). Contribuições de código, docs e testes são bem-vindas.

## Antes de começar

1. Leia o [README](./README.md) (portal) e o aviso educacional.
2. Backend: [backend/README.md](./backend/README.md)
3. Frontend: [frontend/README.md](./frontend/README.md)
4. Copie apenas os exemplos de env — **nunca** commit `.env`, certificados ou dados reais de clientes.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local   # opcional
pnpm install
pnpm db:setup
pnpm dev
```

## Fluxo de contribuição

1. Abra uma issue (ou descreva o problema no PR) antes de mudanças grandes.
2. Crie um branch a partir de `main` (`feat/…`, `fix/…`, `docs/…`).
3. Mantenha PRs focados (um assunto por PR).
4. Garanta que o que você tocou continua verde:

```bash
pnpm test:backend          # fiscal-core + nfe-xml + backend
pnpm lint                  # frontend
pnpm --filter @msimulation-xml/backend exec tsc --noEmit
```

5. Descreva o *porquê* no PR; linke issues se houver.

## Regras do projeto (resumo)

- **Thin client:** lógica fiscal, XML e parse de planilhas ficam no **backend**, não no frontend.
- **Clean Architecture (backend):** `domain` não importa Fastify/Prisma.
- **Secrets:** só placeholders em `.env.example`. Sem chaves reais, dumps ou CNPJs de produção no git.
- **Idioma do código:** inglês (exceto termos fiscais BR: NFe, CTe, CFOP, CST…).

Convenções completas (commands, estrutura, estilo, testes, boundaries): [`docs/specs/monorepo-conventions.md`](./docs/specs/monorepo-conventions.md).

## Por onde começar (onboarding)

Sugestão de exploração (1–2 semanas):

| Semana | Foco | Ações |
| ------ | ---- | ----- |
| **1** | Ambiente + mapa | `pnpm db:setup && pnpm dev`; ler README + `backend/README.md`; Prisma Studio |
| **1** | Frontend | Fluxo `produtos` → `actions.ts` → `fiscal-api` → controller |
| **2** | Backend | CRUD em `catalog` ou `org`: controller → use case → repository |
| **2** | Fiscal | Ler [`backend/docs/fiscal/regras-fulfillment-cat31.md`](./backend/docs/fiscal/regras-fulfillment-cat31.md); emitir uma remessa e rastrear o código |
| **3+** | Domínio | Aprofundar `tax`, `remessas` ou `sales` |

### Checklist antes do primeiro PR

- [ ] `pnpm db:setup && pnpm dev` sobe sem erro
- [ ] Entendo `domain` / `application` / `infrastructure` / `presentation`
- [ ] Sei a diferença UI validation vs domínio
- [ ] Li o aviso: simulador, não produção SEFAZ
- [ ] Não coloquei lógica fiscal no frontend

## Licença

Ao contribuir, você concorda que suas contribuições são licenciadas sob a [MIT License](./LICENSE).

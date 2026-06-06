<p align="center">
  <img src="../docs/assets/msimulation-logo.svg" alt="MSimulation XML" width="64" height="64" />
</p>

<h1 align="center">MSimulation XML — Frontend</h1>

<p align="center"><code>@msimulation-xml/frontend</code> · Next.js 15 · Tailwind v4</p>

Next.js 15 (App Router), Tailwind v4, cockpit fiscal **MSimulation XML** (UI migrada do antigo TanStack/Vite).

### Marca na UI

- Logo: `src/components/brand-logo.tsx` (variantes `full`, `compact`, `mark`, `hero`)
- Tokens: `src/lib/brand.ts` e cores `--brand-glow` / `--brand-xml` em `src/app/globals.css`

Na **raiz do monorepo**:

```bash
pnpm dev          # sobe este app (porta 3000)
pnpm dev:frontend # idem
pnpm build        # build frontend + backend
```

Rotas em `src/app/(app)/`. Componentes e mocks em `src/components` e `src/lib`.

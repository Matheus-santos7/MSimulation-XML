# Spec: composição de `<infAdic><infCpl>` — fulfillment EBazar / ML Full

> **STATUS: APPROVED** (2026-07-23)  
> Fonte de verdade para plan → tasks → implement.  
> Substitui o escopo da spec cancelada `docs/specs/infcpl-regimes-uf.md` (histórico).

---

## Decisions log

| # | Decisão |
|---|---|
| 1 | O sistema emite **apenas** notas fulfillment → composer em **todas** as NF-e |
| 2 | Prefixos de operação **substituem** aberturas CAT 31 / “Enviado diretamente…” |
| 3 / E | Separador entre segmentos = **espaço único** |
| 4 | Regime só com match **exato** UF + CNPJ (dígitos) |
| 5 | `ufDestino` + `cnpjFilial` como definidos |
| 6 / A | **Criar** `RETORNO_FISICO` e `INSULCESSO_DE_ENTREGA` |
| 7 | `REMESSA_AVANCO` → texto de **`REMESSA`** |
| 8 / F | **ASCII** (sem acentuação) |
| 9 / B / C | **Preservar** miolo rico; impostos destacados (IBPT/DIFAL) onde já existiam |
| 10 | Mapa de regimes **só em código** |
| 11 | Spec anterior cancelada OK |
| D / H | Devolução / insucesso: interpolar **numero + serie + data emissao** da NF-e de origem |
| G | Texto insucesso aprovado (ver tabela); enum permanece `INSULCESSO_DE_ENTREGA` (API) vs “Insucesso” no `<infCpl>`/UI |
| I | **Decisão do agente (fiscal):** remessa* mantém IE do OL no miolo; retornos sem miolo de IE (ver § Miolo) |
| B' | `buildInfAdicNode` une `mensagemPadrao` + composer + DIFAL do emitter com **espaço** (sem `\|`) |

---

## ASSUMPTIONS (aprovadas)

1. Todas as NF-e usam o composer.
2. Head = descrição da operação; miolo = conteúdo rico / IE / impostos conforme tabela; sufixo = regime se match.
3. Fórmula: `{head} {middle?} {regime?}` — um espaço; sem `|` entre blocos do composer; sem `\n`; sem markdown.
4. Regime: UF uppercase + CNPJ dígitos; 8 filiais; senão omite.
5. `ufDestino` = UF do destinatário; `cnpjFilial` = CNPJ do CD/filial EBazar da operação.
6. Novos `NFeTipo`: `RETORNO_FISICO`, `INSULCESSO_DE_ENTREGA`. Enum `INSULCESSO_DE_ENTREGA`; texto ASCII “Insucesso…”.
7. `REMESSA_AVANCO` → `operation: "REMESSA"`.
8. Strings canônicas ASCII (`n` não `nº`; `-` não `–`).
9. Venda mantém miolo com CD + retorno simbólico + IBPT + DIFAL.
10. Mapa de regimes em código.
11. Esta spec prevalece sobre o texto literal de `<infCpl>` em `regras-fulfillment-cat31.md` para a **abertura**; a doc CAT 31 continua válida para CFOP/natureza/`<retirada>` etc.

### Decisão I (miolo remessa/retorno) — por quê

Conforme `backend/docs/fiscal/regras-fulfillment-cat31.md` §1, a remessa inbound deve informar a **IE do Operador Logístico** no `<infCpl>`. Já §§ 2.2 e 3 (retornos) **não** exigem IE no complemento — a IE já vai no destinatário da própria NF-e.

**Regra I:**

| Operação | Miolo |
|---|---|
| `REMESSA`, `REMESSA_AVANCO`, `REMESSA_SIMBOLICA` | `Inscricao Estadual do Operador Logistico: {IE}` quando IE presente; se pós-devolução, acrescentar ref. da devolução (`n {numero} emitida em {data} serie {serie}`) |
| `RETORNO_SIMBOLICO`, `RETORNO_FISICO` | **sem** miolo de IE (só head + regime) |
| `TRANSFERENCIA` | mesmo padrão de remessa (IE do dest/CD quando houver) |
| `VENDA_FULFILLMENT` | miolo rico atual (CD + retorno + impostos), sem a abertura antiga |
| `DEVOLUCAO`, `INSULCESSO_DE_ENTREGA` | interpolação na **head**; miolo extra só se houver imposto destacado / CD |

---

## Objective

Compor `NF-e.infAdic.infCpl` de forma determinística:

1. Iniciar com descrição da operação (ASCII).
2. Preservar miolo fiscal/logístico (IE nas remessas; CD/impostos na venda; refs pós-devolução).
3. Terminar com regime especial EBazar quando UF+CNPJ casarem.
4. Criar tipos `RETORNO_FISICO` e `INSULCESSO_DE_ENTREGA`.

### Acceptance criteria

1. Remessa sem regime começa com `Remessa para armazenamento em fulfillment.` e, com IE, contém `Inscricao Estadual do Operador Logistico: {IE}`.
2. Remessa SC + CNPJ `03007331012077` termina com `Regime Especial SC - TTD SC n 225000004034256.`
3. Venda: head nova + miolo com impostos + regime opcional.
4. Devolução/insucesso: head com `n {numero} serie {serie}` e data `dd/mm/aaaa` (America/Sao_Paulo).
5. Retornos: head (+ regime); **sem** exigir IE no miolo.
6. ASCII; sem `\n`/markdown.

---

## Tech Stack

- TypeScript: `fiscal-core`, `nfe-xml`, backend Prisma
- Builders Strategy + `buildInfAdicNode`
- Testes `node:test` + `tsx`
- Migration Prisma: `RETORNO_FISICO`, `INSULCESSO_DE_ENTREGA`

---

## Commands

```bash
pnpm --filter @msimulation-xml/fiscal-core build
pnpm --filter @msimulation-xml/nfe-xml build
pnpm --filter @msimulation-xml/fiscal-core test
pnpm --filter @msimulation-xml/nfe-xml test
pnpm --filter @msimulation-xml/backend exec prisma migrate dev
pnpm --filter @msimulation-xml/backend exec tsc --noEmit
```

---

## Project Structure

```
docs/specs/infcpl-fulfillment-ebazar.md
packages/fiscal-core/src/infcpl/          → composer + regimes + unit tests
packages/nfe-xml/src/builders/            → consomem composer
packages/nfe-xml/src/fiscal/fiscal-xml.util.ts  → wrappers deprecated
backend/prisma/schema.prisma              → novos NFeTipo
backend/src/modules/...                   → emissão / payload
```

---

## Code Style

```ts
export type FulfillmentInfCplOperation =
  | "REMESSA"
  | "REMESSA_SIMBOLICA"
  | "RETORNO_SIMBOLICO"
  | "RETORNO_FISICO"
  | "VENDA_FULFILLMENT"
  | "TRANSFERENCIA"
  | "DEVOLUCAO"
  | "INSULCESSO_DE_ENTREGA";

export type FulfillmentInfCplInput = {
  operation: FulfillmentInfCplOperation;
  ufDestino: string;
  cnpjFilial: string;
  middle?: string | null;
  /** DEVOLUCAO / INSULCESSO_DE_ENTREGA (e refs de remessa simbólica pós-devolução). */
  nfeOrigem?: { numero: number; serie: number; emitidaEm: Date | string };
};

export function buildFulfillmentInfCplText(input: FulfillmentInfCplInput): string {
  const head = resolveOperationText(input);
  const middle = input.middle?.trim() ?? "";
  const regime = resolveRegimeEspecial(input.ufDestino, input.cnpjFilial) ?? "";
  return [head, middle, regime].filter(Boolean).join(" ");
}
```

Data de emissão no texto: `dd/mm/aaaa` via `America/Sao_Paulo` (mesmo fuso dos helpers atuais de remessa).

### Operação (ASCII)

| `operation` | Texto |
|---|---|
| `REMESSA` | `Remessa para armazenamento em fulfillment.` |
| `REMESSA_SIMBOLICA` | `Remessa simbolica para armazenamento em fulfillment.` |
| `RETORNO_SIMBOLICO` | `Retorno simbolico de mercadoria armazenada em fulfillment.` |
| `RETORNO_FISICO` | `Retorno fisico de mercadoria armazenada em fulfillment.` |
| `VENDA_FULFILLMENT` | `Venda de mercadoria armazenada em fulfillment.` |
| `TRANSFERENCIA` | `Transferencia de mercadoria para estabelecimento de fulfillment.` |
| `DEVOLUCAO` | `Devolucao de mercadoria referente a NF-e de origem n {numero} serie {serie} emitida em {dd/mm/aaaa}.` |
| `INSULCESSO_DE_ENTREGA` | `Insucesso de entrega de mercadoria referente a NF-e de origem n {numero} serie {serie} emitida em {dd/mm/aaaa}.` |

### Regime (ASCII; final)

| UF | CNPJ | Texto |
|---|---|---|
| BA | `03007331009793` | `Regime Especial BA - Parecer DITRI/GETRI n 3828/2022.` |
| SC | `03007331012077` | `Regime Especial SC - TTD SC n 225000004034256.` |
| RJ | `03007331010295` | `Regime Especial RJ - Parecer n 176/2022/SEFAZ/COOCJT.` |
| MG | `03007331013715` | `Regime Especial MG - E-PTA-RE n 45.000038282-71.` |
| DF | `03007331004643` | `Regime Especial DF - Ato Declaratorio n 2/2024.` |
| RS | `03007331019160` | `Regime Especial RS - Ato Declaratorio n 2023/107.` |
| PR | `03007331001628` | `Regime Especial PR - Regime Especial n 7975/2022.` |
| PE | `03007331018350` | `Regime Especial PE - Edital DPC n 077/2024.` |

### Exemplos

Remessa SC com IE:

```
Remessa para armazenamento em fulfillment. Inscricao Estadual do Operador Logistico: 261755994. Regime Especial SC - TTD SC n 225000004034256.
```

Retorno simbólico SC:

```
Retorno simbolico de mercadoria armazenada em fulfillment. Regime Especial SC - TTD SC n 225000004034256.
```

Devolução:

```
Devolucao de mercadoria referente a NF-e de origem n 100 serie 1 emitida em 17/06/2026.
```

---

## Testing Strategy

| Nível | O quê |
|---|---|
| Unit composer | Todas operations; 8 regimes; ASCII; interpolação n+serie+data; REMESSA_AVANCO≡REMESSA; remessa com/sem IE; retorno sem IE |
| XML builders | Asserts `<infCpl>`; venda com IBPT/DIFAL no miolo |
| Backend | Novos tipos persistem; payload origem na devolução/insucesso |

---

## Boundaries

### Always

- Um composer para os três blocos.
- ASCII; CNPJ normalizado; IE só dígitos no miolo de remessa.
- Preservar impostos na venda.
- Incluir migration dos novos `NFeTipo` (ask first se fatia só `infCpl` sem telas de emissão).
- Testes no mesmo PR.

### Ask first

- Escopo da **UI/use-cases** de emissão de `RETORNO_FISICO` / `INSULCESSO_DE_ENTREGA` vs só enum + XML nesta fatia.
- Remover vs `@deprecated` helpers legados.
- Atualizar `regras-fulfillment-cat31.md`.
- Novos pares UF/CNPJ.

### Never

- Abertura CAT 31 como head.
- Acentos / markdown / `\n`.
- Descartar IBPT/DIFAL da venda.
- Exigir IE no miolo de retorno.
- Chumbar alíquotas no `infCpl`.

---

## Success Criteria

- [ ] Composer + mapa + unit tests
- [ ] Builders consumindo composer; venda com impostos no miolo
- [ ] Remessa com IE; retorno sem IE no miolo
- [ ] Devolução/insucesso: n + serie + data
- [ ] `NFeTipo` com `RETORNO_FISICO` e `INSULCESSO_DE_ENTREGA`
- [ ] Suites verdes
- [ ] Próximo passo: `planning-and-task-breakdown` → `tasks/plan.md` + `tasks/todo.md` (quando o humano pedir)

---

## Open Questions

*Nenhuma.* G–I fechadas.

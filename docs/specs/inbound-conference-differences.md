# Spec: Conferência INBOUND — POSITIVE / NEGATIVE difference

> **STATUS: APPROVED** (2026-07-24) · smoke homologação **OK**  
> Intent: [`docs/intent/inbound-conference-differences.md`](../intent/inbound-conference-differences.md) **CONFIRMED**  
> Decisões: reconferência **permitida**; POSITIVE com **allowlist completa** da planilha.  
> Fonte: `Tabela_Processos_Fulfillment_ML.xlsx` + [obtendo-nota-fiscal](https://developers.mercadolivre.com.br/pt_br/obtendo-nota-fiscal)

---

## Objective

Permitir testar, em homologação, a **conferência de recebimento** de uma remessa INBOUND: quando a quantidade recebida diverge da enviada (ou do saldo atual, em reconferência), o sistema emite a NF-e ML do delta e **ajusta o saldo FIFO** na mesma operação.

Recebimento **default = OK** (sem NF extra). A conferência é uma **ação explícita** do operador.

### Success

- Remessa pai com 10 un; conferência recebe 9 → 1 NF `INBOUND_NEGATIVE_DIFFERENCE` (qtd 1) + FIFO −1.
- Remessa pai com 10 un; conferência recebe 11 → 1 NF `INBOUND_POSITIVE_DIFFERENCE` (qtd 1) + FIFO +1.
- Reconferência: `expected` = **saldo FIFO atual**; mesmo recebido → delta 0 → não reemite.
- Sem conferência → FIFO = quantidade da remessa; nenhuma NF filha de diferença.

---

## Decisions log

| # | Decisão |
|---|---|
| 1 | Spec APPROVED |
| 2 | Reconferência **permitida** (`expected` = saldo FIFO atual) |
| 3 | POSITIVE: allowlist **completa** da planilha (`6409, 5949, 6949, 6152, 6904, 6151, 5152, 5904`) |
| 4 | NEGATIVE: allowlist `1904, 2949, 2904, 1949` |
| 5 | Default CFOP POSITIVE: `5949`/`6949` por UF (como remessa); outros da allowlist via settings/override opcional |
| 6 | Default CFOP NEGATIVE: `1949`/`2949` por UF (como retorno físico atual) |

---

## ASSUMPTIONS (aprovadas)

1. 1ª fatia = INBOUND base + POSITIVE/NEGATIVE (não supplier/filial).
2. UI: ação “Conferência” com esperado×recebido por item.
3. Uma conferência pode gerar 0–N NFs (agrupar por sinal: uma NEGATIVE com itens em falta, uma POSITIVE com itens a mais — ou uma NF por item se multi-SKU exigir; preferência **1 NF por sinal** agregando itens do mesmo sinal).
4. NEGATIVE → `inbound_return` / caminho retorno parcial + FIFO −.
5. POSITIVE → `inbound` remessa-delta + FIFO +; CFOP ∈ allowlist completa.
6. `xTexto`: `INBOUND_POSITIVE_DIFFERENCE-inbound-…` e `INBOUND_NEGATIVE_DIFFERENCE-inbound_return-…`.
7. FIFO ajustado na mesma transação da emissão.
8. Reconferência permitida; baseline = saldo FIFO atual (não a qtd original da remessa).
9. Saldo lógico `expected` = saldo do pai + saldo das filhas com `fiscalPayload.mlProcess === "INBOUND_POSITIVE_DIFFERENCE"` (não qualquer REMESSA referenciada).

---

## Allowlists (planilha)

**INBOUND_POSITIVE_DIFFERENCE (`inbound`)**  
`6409, 5949, 6949, 6152, 6904, 6151, 5152, 5904`

**INBOUND_NEGATIVE_DIFFERENCE (`inbound_return`)**  
`1904, 2949, 2904, 1949`

---

## Commands

```bash
pnpm --filter @msimulation-xml/fiscal-core test
pnpm --filter @msimulation-xml/backend exec tsx --test src/modules/remessas/**/*.test.ts
pnpm --filter @msimulation-xml/backend exec tsx --test src/modules/fiscal-documents/**/*.test.ts
pnpm --filter @msimulation-xml/backend exec tsc --noEmit
```

---

## Project Structure

```
packages/fiscal-core/src/inbound-conference-cfop.ts  → allowlists + resolve default CFOP
packages/fiscal-core/src/inbound-conference-delta.ts → cálculo de deltas
packages/fiscal-core/src/inbound-conference-payload.ts → identifica filha POSITIVE via mlProcess
packages/fiscal-core/src/nfe-xtexto.ts               → xTexto POSITIVE/NEGATIVE
backend/.../remessas|fiscal-documents                → orquestração + emit + FIFO
frontend/...                                         → UI Conferência
```

---

## Testing Strategy

| Nível | Cobertura |
|-------|-----------|
| Unit | Deltas; allowlist; xTexto; default CFOP UF |
| Integration leve | FIFO −/+; reconferência delta 0 |
| Smoke | Checklist abaixo |

---

## Boundaries

**Always:** conferência explícita; só delta; FIFO atômico; TaxRule; CFOP ∈ allowlist.  
**Ask first:** supplier/filial; mudar retorno físico total legado.  
**Never:** auto-emitir no “recebimento implícito”; hardcode alíquota; misturar sinais no mesmo XML.

---

## Acceptance criteria

1. Conferência aceita linhas esperado×recebido (esperado = saldo atual na UI).
2. Só |delta| > 0 gera NF.
3. NEGATIVE + FIFO −; POSITIVE + FIFO +; xTexto processo ML.
4. Transação atômica.
5. Reconferência com mesmo recebido → noop.
6. CFOP POSITIVE fora da allowlist → erro.
7. Testes + smoke.

---

## Smoke checklist

| # | Caso | Esperado |
|---|------|----------|
| 1 | Remessa 10, sem conferência | FIFO 10 |
| 2 | Confere 9 | NEGATIVE 1; FIFO 9 |
| 3 | Reconfere 9 | noop |
| 4 | Reconfere 11 (após 9) | POSITIVE 2; FIFO 11 |
| 5 | Remessa nova 10 → confere 11 | POSITIVE 1; FIFO 11 |
| 6 | xTexto / natOp | Conforme processo |

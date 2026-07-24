# Spec: Matriz SALE (ML Full) — venda + retorno simbólico por CFOP

> **STATUS: APPROVED** (2026-07-24)  
> Decisões: retorno simbólico cobre **os 6 CFOPs** da allowlist; smoke + plan em `tasks/`.  
> Escopo: 1ª fatia do simulador de processos Fulfillment ML.  
> Fonte de processo: `Tabela_Processos_Fulfillment_ML.xlsx` + [obtendo-nota-fiscal](https://developers.mercadolivre.com.br/pt_br/obtendo-nota-fiscal) (Tabela de processos Fulfillment).  
> Specs relacionadas: `docs/specs/infcpl-fulfillment-ebazar.md`, `backend/docs/fiscal/regras-fulfillment-cat31.md`.

---

## Smoke checklist (homologação)

Pré-requisitos: migration `sujeito_st` aplicada; TaxRules `sale` + `inbound` importadas (XLSX); remessa com saldo FIFO.

| # | Caso | Esperado |
|---|------|----------|
| 1 | Settings `comercio` + `armazem_geral`; venda NC **intra** | CFOP venda `5106`; retorno simbólico pareado |
| 2 | Mesmo, NC **inter** | CFOP venda `6106` |
| 3 | Settings `industria` + `armazem_geral`; NC intra/inter | `5105` / `6105` |
| 4 | `xTexto` | `SALE-sale-…` e `SALE-symbolic_inbound_return-…` |
| 5 | Pedido com itens ST + não-ST mistos | Erro (não emite) |
| 6 | TaxRule importada (`cfop=""`) | Emite sem erro de alinhamento CFOP |
| 7 | Retorno: natureza / remessa | Pares `1949/2949`, `1904/2904`, `1907/2907` conforme settings ou remessa `5905`→`1907` |
| 8 | Impostos do retorno | Resolve `symbolic_inbound_return` → alias `inbound` XLSX (sem falha “sem linha”) |

**Como validar rápido:** emitir venda Full na UI → abrir XMLs do par → checar `det/prod/CFOP`, `infAd/obsCont/xTexto`, e que o retorno tem ICMS coerente com a linha inbound da planilha.

Smoke homologação: **OK** (2026-07-24) → Phase 0 marcada em `tasks/todo.md`.
## Decisions log (confirmadas na entrevista)

| # | Decisão |
|---|---|
| 1 | Simulador emite em **homologação** o que o ML realiza em produção |
| 2 | Cobertura eventual = **todos** os processos da planilha (emissão completa) |
| 3 | **1ª fatia = SALE** = par `sale` + `symbolic_inbound_return` |
| 4 | CFOP de retorno escolhido **automaticamente** (UF/natureza) — sem input manual |
| 5 | Tributação (alíquotas/CST) via **TaxRule / motor** por **CFOP + UF + regime** — sem alíquota hardcoded |
| 6 | Natureza / `xTexto` alinhados à planilha ML |
| 7 | **CFOP de venda (e remessa armazenagem)** pela **árvore de decisão** (`resolveCfopByDecisionTree`) — ver § Roteamento |

---

## Roteamento CFOP (árvore de decisão) — canônico

Implementação: `packages/fiscal-core/src/cfop-routing.ts`  
Sales Chain Full: `emit-sale-note` usa `logistica: "armazem_geral"` + `perfilVendedor: "comercio"` (default até existir campo no Tenant).

### Regras

1. **Prefixo:** mesma UF → `5xxx`; UFs diferentes → `6xxx` (emitente → destinatário).
2. **`remessa_armazenagem`:** `5905` / `6905`.
3. **`venda` + `armazem_geral` (Full):** indústria `5105`/`6105`; comércio `5106`/`6106`.
4. **`venda` + `estoque_proprio` + ST:** `5405` (intra); inter `6403` (protocolo) ou `6404` (imposto retido).
5. **`venda` + `estoque_proprio` sem ST:**
   - comércio: `5102` | `6102` (contribuinte) | `6108` (consumidor final)
   - indústria: `5101` | `6101` (contribuinte) | `6107` (consumidor final)

### Validação fiscal (2026-07-23)

| CFOP | Descrição oficial (RF/Confaz / tabela CFOP) | Árvore |
|------|-----------------------------------------------|--------|
| 5105 / 6105 | Venda de **produção** que **não deve transitar** pelo estabelecimento | Full + indústria ✅ |
| 5106 / 6106 | Venda de mercadoria de **terceiros** que **não deve transitar** | Full + comércio ✅ |
| 5101 / 6101 | Venda de produção do estabelecimento | Estoque próprio + indústria ✅ |
| 5102 / 6102 | Venda de mercadoria de terceiros | Estoque próprio + comércio (contribuinte inter) ✅ |
| 6107 | Venda de produção **destinada a não contribuinte** (interestadual) | Estoque próprio + indústria + CF ✅ |
| 6108 | Venda de mercadoria de terceiros **destinada a não contribuinte** | Estoque próprio + comércio + CF ✅ |
| 5405 / 6403 / 6404 | ST (já paga / protocolo / retido) | Estoque próprio + ST ✅ |
| 5905 / 6905 | Remessa para depósito fechado / armazém | Remessa armazenagem ✅ |

**Nota:** o dicionário MCP `consultar_cfop` ainda descreve 6107/6108 como ZFM/exportação — **desatualizado**. A tabela RF/Confaz vigente e a prática e-commerce alinham com **não contribuinte** (ZFM = 6109/6110).

**Tensão CAT 31:** `backend/docs/fiscal/regras-fulfillment-cat31.md` cita remessa com **5949** e venda com exemplos `5102`/`6102`. Para Full, a árvore (e a descrição “não deve transitar”) privilegia **5105/6105–5106/6106** na venda e **5905/6905** na remessa de armazenagem. Allowlist ML SALE ainda lista 5949/6949 — tratar como processos/planilha ML, não como default da árvore de venda Full.

### Análise TaxRule / configuração — o que falta

| Necessário para a árvore | Existe hoje? | Gap |
|--------------------------|--------------|-----|
| UF origem (emitente) | ✅ `Tenant.uf` | — |
| UF destino (comprador / CD) | ✅ pedido / remessa | — |
| `customerType` (contribuinte) | ✅ `indIEDest` → taxpayer/non_taxpayer | — |
| `logistica` armazém vs próprio | ✅ `basic.logisticaPadrao` (settings) | UI em Forma de Faturamento |
| `perfil_vendedor` indústria/comércio | ✅ `basic.perfilVendedor` (settings) | UI em Forma de Faturamento |
| `produto_st` | ✅ `Product.sujeitoSt` | Pedido **não** pode misturar ST e não-ST |
| `stInterestadualMode` 6403 vs 6404 | ✅ `basic.stInterestadualMode` | Default `imposto_retido` |
| TaxRule por CFOP+UF+regime | ✅ alíquotas via `icmsByUf`; **CFOP não vem do XLSX** (`cfop=""`) | CFOP = árvore; `assertTaxRuleCfopMatchesTree` só se CFOP manual na regra |
| TaxRule `symbolic_inbound_return` | ✅ resolve com alias → `inbound` XLSX | CFOP retorno: árvore 6 códigos (`sale-return-cfop.ts`) |
| Motor ICMS-ST (`vBCST`) | ✅ CST 10/30/70/60 + XML + CEST | Smoke homologação ST |

**Uso:** Sales Chain chama `saleRoutingFromEmitterSettings(emitterSettings, { produtoSt })` → `resolveSaleCfop(..., routing)`.
ST só é considerado se `logisticaPadrao === "estoque_proprio"` (Full ignora `sujeitoSt` na árvore).

---

## ASSUMPTIONS

1. Allowlist de CFOPs SALE vem da planilha; processos fora da árvore (ex. 5949 em “sale”) exigem caminho explícito futuro.
2. Na Sales Chain Full, CFOP de **venda** vem da árvore (`armazem_geral`); **tributação** continua de TaxRule `sale` por UF/regime.
3. Para o retorno simbólico, o CFOP efetivo vem de TaxRule `symbolic_inbound_return` (ainda a implementar — hoje hardcode 1949/2949).
4. `perfilVendedor` default `comercio` até existir configuração no Tenant/settings.
5. ST Full via armazém geral **não** está na árvore (erro explícito) — ST só em `estoque_proprio`.
6. Escopo **fora** desta fatia de processos: INBOUND_*, DEVOLUTION, WAREHOUSE_TRANSFER_*, LOST, etc.

---

## Objective

Permitir que o simulador, em homologação, emita o processo ML **SALE** com:

1. NF-e de **venda** (`transaction_type` / `xTexto` prefixo `SALE-sale`) para **qualquer CFOP** da allowlist `sale`, com impostos calculados pelo motor a partir de TaxRule (CFOP+UF+regime).
2. NF-e de **retorno simbólico** pareada (`SALE-symbolic_inbound_return`), com CFOP **escolhido automaticamente** via TaxRule (`symbolic_inbound_return` + UF emitente/CD + regime), dentro da allowlist de retorno.
3. Natureza da operação alinhada à planilha:
   - Venda: `Venda de mercadorias`
   - Retorno: `Outras Entradas - Retorno Simbolico de Deposito Temporario` (ASCII do projeto)

### Allowlist (fonte: planilha)

**sale**

`5101, 5102, 5105, 5106, 5405, 5949, 5905, 6101, 6102, 6105, 6106, 6107, 6108, 6403, 6404, 6905, 6949`

**symbolic_inbound_return**

`1949, 2949, 1904, 1907, 2904, 2907`

### Acceptance criteria

1. Dado TaxRule `sale` com CFOP `C` na allowlist e UFs coerentes, a cadeia emite venda com CFOP `C` (ou normalizado 5↔6 pela UF) e impostos da regra — **sem** alíquota literal no código de emissão.
2. O CFOP do retorno **não** é informado pelo caller; é resolvido só por TaxRule + UF (e validado na allowlist de retorno).
3. Hardcode atual `resolveRetornoSimbolicoCfop` → `1949`/`2949` deixa de ser a fonte de verdade; no máximo fallback documentado **ou** remoção total (preferência: remoção — falha se não houver regra).
4. `resolveSalesChainRules` busca retorno com `transactionType: "symbolic_inbound_return"` (não reutilizar semanticamente `inbound` sem alias explícito).
5. Suite de testes parametrizada: pelo menos um caso por CFOP `sale` da allowlist (pode ser unitário com TaxRule fixture), cada um gerando par venda+retorno com `xTexto`/`natOp` corretos.
6. CFOPs de retorno `1904, 1907, 2904, 2907` cobertos por fixtures de TaxRule (pelo menos smoke: resolução + XML `cfop` do det).
7. Tentativa de emitir CFOP fora da allowlist SALE → erro de domínio claro.
8. Documentação CAT 31 / spec infCpl existente permanece válida para textos; esta spec manda em CFOP/TaxRule da cadeia SALE.

---

## Tech Stack

- TypeScript monorepo (`packages/fiscal-core`, `packages/nfe-xml`, `backend` sales/tax/remessas)
- Prisma `tax_rule` + `resolveTaxRuleFromDb` / `resolveTaxRule`
- Sales Chain: `SalesChainOrchestrator`, `emit-sale-note`, `emit-return-note`
- Testes: `node:test` + `tsx` (padrão do repo)

---

## Commands

```bash
pnpm --filter @msimulation-xml/fiscal-core test
pnpm --filter @msimulation-xml/nfe-xml test
pnpm --filter @msimulation-xml/backend exec tsx --test src/modules/sales/**/*.test.ts
pnpm --filter @msimulation-xml/backend exec tsx --test src/modules/tax/**/*.test.ts
pnpm --filter @msimulation-xml/backend exec tsc --noEmit
```

(Ajustar globs aos paths reais dos novos testes.)

---

## Project Structure

```
docs/specs/sale-fulfillment-cfop-matrix.md     → esta spec
Tabela_Processos_Fulfillment_ML.xlsx           → catálogo ML (fonte)
packages/fiscal-core/src/sale-cfop.ts          → normalização UF + (novo) allowlist SALE
packages/fiscal-core/src/nfe-xtexto.ts         → SALE-sale / SALE-symbolic_inbound_return
backend/src/modules/sales/.../resolve-sales-chain-rules.ts
backend/src/modules/sales/.../emit-sale-note.ts
backend/src/modules/sales/.../emit-return-note.ts
backend/src/modules/remessas/.../retorno-simbolico-dest.ts  → CFOP deixa de hardcodar
backend/src/modules/tax/...                    → resolução transactionType symbolic_inbound_return
```

---

## Code Style

```ts
/** Allowlist canônica — espelha planilha ML processo SALE. */
export const ML_SALE_CFOPS = [
  "5101", "5102", "5105", "5106", "5405", "5949", "5905",
  "6101", "6102", "6105", "6106", "6107", "6108", "6403", "6404", "6905", "6949",
] as const;

export const ML_SALE_RETURN_CFOPS = [
  "1949", "2949", "1904", "1907", "2904", "2907",
] as const;

export function assertMlSaleCfop(cfop: string): void { /* throw domain error se fora */ }

/** Retorno: CFOP só da TaxRule resolvida; validar allowlist. */
export function resolveReturnCfopFromTaxRule(rule: { cfop?: string }): string {
  const cfop = rule.cfop?.trim() ?? "";
  assertMlSaleReturnCfop(cfop);
  return cfop;
}
```

- Sem alíquotas literais (`pICMS = 18`) em builders.
- Preferir reutilizar `resolveSaleCfop` para coerência intra/inter.
- Nomes de transactionType alinhados à planilha ML (`sale`, `symbolic_inbound_return`).

---

## Testing Strategy

| Nível | O quê |
|-------|--------|
| Unit | Allowlist; resolução CFOP retorno a partir de regra mock; `resolveSaleCfop` × cada CFOP sale (intra/inter) |
| Unit/integration leve | `resolveTaxRule` com fixtures `sale` e `symbolic_inbound_return` por CFOP |
| Builder / XML | Snapshot ou asserts em `<CFOP>`, `<natOp>`, `xTexto` do par venda+retorno |
| Negativo | Sem TaxRule → erro; CFOP fora allowlist → erro; CFOP retorno 5xxx em operação que exige 1/2 → falha na validação da regra |

Cobertura mínima da fatia: **1 teste parametrizado por CFOP da allowlist sale** + **smoke dos 6 CFOPs de retorno**.

---

## Boundaries

**Always**
- Tributação via TaxRule/motor
- Validar allowlist ML antes de persistir XML
- Manter par venda + retorno na Sales Chain
- Atualizar esta spec se a allowlist da planilha mudar

**Ask first**
- Seed/migration de TaxRules em massa para todos os CFOPs em tenants reais
- UI de “matriz CFOP” no frontend
- (Feito) Alias `symbolic_inbound_return` → `inbound` na resolução TaxRule

**Never**
- Hardcodar alíquota ICMS/PIS/COFINS no caminho SALE
- Emitir CFOP de retorno escolhido manualmente pelo payload da API de venda
- Expandir para outros processos ML nesta fatia

---

## Success Criteria

- [ ] Allowlist SALE (`sale` + `symbolic_inbound_return`) em `fiscal-core`, testada
- [x] Sales Chain resolve retorno via TaxRule `symbolic_inbound_return`; CFOP automático
- [x] Removido (ou degradado documentado) o hardcode 1949/2949 como fonte única
- [ ] Matriz de testes cobre todos os CFOPs `sale` da planilha
- [x] Smoke dos CFOPs de retorno além de 1949/2949
- [x] Nenhuma alíquota nova hardcoded introduzida
- [x] Spec marcada APPROVED após review humano

---

## Gap vs código atual (contexto)

Fonte: exploração Sales Chain + TaxRule + builders (2026-07-23).

| Área | Hoje | Alvo |
|------|------|------|
| CFOP venda | Árvore `resolveCfopByDecisionTree` + TaxRule só impostos | Allowlist completa + fixtures por CFOP |
| CFOP retorno | Árvore 6 códigos (`sale-return-cfop.ts`) | — feito (CFOP); impostos via alias Task 2 |
| `resolveSalesChainRules` | `symbolic_inbound_return` + alias `inbound` | — feito |
| Schema TaxRule | `sale` \| `inbound` \| `symbolic_inbound_return` (String) | Import XLSX segue gravando `inbound` |
| ICMS-ST (`5405`, `6403`, `6404`) | Engine + XML + CEST (`docs/specs/icms-st-engine.md`) | Smoke homologação |
| `5949`/`6949`/`5905`/`6905` | Remessa/armazenagem na árvore; `6949` vs xTexto | Allowlist + xTexto estrito por `NFeTipo` |

### Gaps críticos

1. Retorno via TaxRule (remover hardcode como fonte de verdade).
2. ST: sem engine, `5405`/`6403`/`6404` não fecham SEFAZ — ver Open Question 4.
3. Allowlist: validar CFOP emitido ∈ planilha SALE.
4. Fixtures: TaxRule por CFOP `sale` + smoke dos 6 CFOPs de retorno.

---

## Open Questions

1. **Fallback:** sem TaxRule `symbolic_inbound_return` — falhar sempre ou fallback `1949`/`2949` só em dev? (Assumption 4: falhar.)
2. **Seed:** fixtures só de teste ou import XLSX no tenant de homologação?
3. **5105/6105:** manter normalização → 5106/6106 para não contribuinte, ou emitir o CFOP da TaxRule no simulador?
4. **ST nesta fatia:** implementar ICMS-ST no `tax-engine` agora (`5405`/`6403`/`6404`), ou adiar ST e cobrir primeiro os CFOPs sem ST?

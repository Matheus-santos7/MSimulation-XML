# Plano de execução: correções da auditoria (2026-11-05)

Documento para o oh-my-claudecode (ou qualquer agente) executar as correções da auditoria `/ponytail:ponytail-audit`, na ordem, com critério de pronto verificável.

## Como usar

- Execute uma tarefa por vez, na ordem da tabela. Cada tarefa = um commit (`<tipo>: <descrição>` em português).
- Marque o status na tabela ao terminar (`[ ]` → `[x]`).
- Fluxo por tarefa: teste que falha (RED) → correção mínima (GREEN) → rodar a verificação → commit.
- Sugestão de comando OMC: `/oh-my-claudecode:ralph` com este arquivo como fonte, ou `/oh-my-claudecode:execute` tarefa a tarefa.
- Um PR altera uma feature ou um pacote (regra do `CLAUDE.md`). Fases A e B são PRs separados.

## Regras que não podem ser quebradas

- `backend/.env` aponta para o **Neon de produção**. Nunca rode migration nem script de escrita contra ele. Banco só no Postgres local via Docker.
- Não edite `backend/src/generated/prisma`.
- Contrato: `.claude/ARCHITECTURE.md` e `.claude/rules/*.md`. Em resumo: imports relativos com `.js`, DTOs em Zod, injeção com `@Inject`, `rules/` e `types/` sem Nest/Fastify, mensagens de erro da API em português, sem `console.log`, sem mutação de argumentos.
- Rota nova ou alterada atualiza `backend/src/test/app.contract.spec.ts` e o snapshot (`UPDATE_CONTRACT_SNAPSHOT=1`). Estas tarefas **não** devem alterar rotas.
- Cobertura mínima de 80% em código novo.

## Verificação padrão (rodar após cada tarefa)

```bash
pnpm --filter @msimulation-xml/backend test
pnpm --filter @msimulation-xml/backend exec tsc --noEmit -p tsconfig.test.json
pnpm --filter @msimulation-xml/backend lint
pnpm depcheck
```

Tarefa que mexe em `packages/*` roda também `pnpm test:backend`.

## Ordem de execução

| # | Status | Tarefa | Fase | Arquivos principais |
|---|--------|--------|------|---------------------|
| T1 | [x] | `set_config` local e remover `clearRlsContext` | A | `backend/src/lib/db/tenant-rls.ts` |
| T2 | [x] | Detectar regra duplicada na planilha | A | `tax-rule-spreadsheet.mapper.ts` |
| T3 | [x] | `bulkUpsert` em poucas consultas | A | `tax-rule.repository.ts` |
| T4 | [x] | Conversão numérica só em colunas numéricas | A | `tax-rule-spreadsheet.parser.ts` |
| T5 | [x] | Upload e parse fora da transação; pool maior | A | `tax-rule.controller.ts`, `api-access.decorators.ts`, `lib/db/prisma.ts` |
| T6 | [x] | Parser único de TTL | B | `backend/src/lib/auth/config.ts` |
| T7 | [x] | Aceitar só `.xlsx` | B | `lib/shared/spreadsheet-upload.ts`, `tax-rule-upload.ts` |
| T8 | [x] | Limitar linhas lidas no `XLSX.read` | B | `tax-rule-spreadsheet.parser.ts` |
| T9 | [x] | Filtro `TaxRuleError` no controller inteiro (descartada: bulkUpsert não lança TaxRuleError) | B | `tax-rule.controller.ts` |
| T10 | [x] | Limpezas (código morto, tipos) | C | `tax-rule-spreadsheet.mapper.ts`, `tax-rule.repository.ts` |
| T11 | [x] | README alinhado | C | `README.md` |

Caminho base das regras tributárias: `backend/src/modules/tax/tax-rule/`.

---

## Fase A: bloqueadores

### T1. `set_config` local e remover `clearRlsContext`

**Problema:** o `finally` de `runWithDbContext` roda uma consulta numa transação já abortada e troca o erro original (ex.: `P2002` → 500 em vez de 409).

**Passos**
1. Teste primeiro, em `backend/src/lib/db/test/`: `runWithDbContext` com um `fn` que lança um erro; o teste exige que o erro propagado seja o original. Use um prisma falso cujo `$transaction` executa o callback e cujo `$executeRaw` falha na segunda chamada (simula transação abortada). Rode: deve falhar.
2. Em `applyRlsContext`, troque o terceiro argumento de `set_config` de `false` para `true` (vale só na transação).
3. Apague `clearRlsContext` e o `try/finally` de `runWithDbContext`. Procure outros usos com `grep -rn clearRlsContext backend/src`.
4. Rode a verificação padrão.

**Pronto quando:** o teste novo passa; nenhum `clearRlsContext` no código; testes de RLS existentes (`lib/db/test`) continuam verdes.

### T2. Detectar regra duplicada na planilha

**Problema:** duas linhas com a mesma chave `RULE_ID-UF-cliente-operação` viram um upsert só; o contador mente.

**Passos**
1. Teste primeiro em `test/tax-rule-spreadsheet.mapper.spec.ts`: duas linhas brutas com mesmo `ruleId`, mesma UF e mesmo tipo de cliente/operação, `ruleName` diferente. Esperado: `rows` com 1 item e `errors` com 1 item de mensagem `Regra duplicada: a linha N repete a chave <chave>`.
2. Em `mapTaxRuleSpreadsheetRows`, mantenha um `Set` das chaves já vistas; na repetição, `errors.push({ line, message })` e `continue`. Não mute `rawRows`.
3. Confirme no frontend (`frontend/src/components/tax-rule-import-form.tsx`) que `parseErrors` é exibido ao usuário. Se não for, mostre. Se o RULE_NAME precisar entrar na identidade, **pare e pergunte ao usuário** antes de mudar a chave (afeta dados já gravados).

**Pronto quando:** teste passa; a resposta de import traz o erro com o número da linha.

### T3. `bulkUpsert` em poucas consultas

**Problema:** uma consulta por linha dentro de uma transação; `Promise.all` não paraleliza. Lento no Neon.

**Passos**
1. Teste primeiro em `test/` (repositório com `getDbClient` falso, no padrão dos specs vizinhos): 25 linhas, 10 já existentes. Esperado: `{ created: 15, updated: 10, total: 25 }` e **no máximo 3** chamadas ao banco (contagem de `$executeRaw`/`findMany`).
2. Reescreva `bulkUpsert`: deduplique por `ruleId` (mantém a última), busque os `ruleId` existentes (já feito), grave tudo com **um** `INSERT ... ON CONFLICT (tenant_id, rule_id) DO UPDATE` via `$executeRaw` com `unnest` de arrays tipados (um array por coluna; `payload` como `jsonb`; confira os tipos de cada coluna no `schema.prisma`). Se ficar grande demais, divida em lotes de 500 linhas.
3. Mantenha `source = 'xlsx'`, `updated_at = now()` no UPDATE e a política RLS (a consulta roda no `getDbClient()` da request).
4. Valide num Postgres **local** (Docker), nunca no Neon: suba com `pnpm db:setup`, importe uma planilha de teste e compare com o resultado do código antigo (mesmos registros e valores).
5. Apague o laço de chunks e o `Promise.all`.

**Pronto quando:** teste passa; 3.000 linhas importam em poucos segundos no Postgres local; contadores iguais aos do código antigo.

### T4. Conversão numérica só em colunas numéricas

**Problema:** `toNumberLike` transforma `"000001"` em `1` e `"12.5"` em `125`.

**Passos**
1. Testes primeiro em `test/tax-rule-spreadsheet.parser.spec.ts`:
   - `IBS_CBS_CCLASSTRIB = "000001"` continua `"000001"`.
   - `IPI_COD_ENQ = "001"` continua `"001"`.
   - `IPI_ALIQUOTA = "12,5"` vira `12.5`; `"1.234,56"` vira `1234.56`.
   - `IPI_ALIQUOTA = "12.5"` gera erro de linha `Valor numérico ambíguo` (ou vira `12.5`; **decida com o usuário** e registre na tabela de decisões).
2. Crie uma lista de colunas numéricas (`*_ALIQUOTA`, `*_REDUCAO`, `ICMS_*_P*`; confira os nomes reais na planilha de exemplo dos testes) como constante nomeada. `normalizeCellValue` converte só essas; as demais ficam como texto aparado.
3. `RULE_ID` e `RULE_NAME` ficam como texto (hoje `"01234567"` perderia o zero).
4. Rode os specs existentes do parser, mapper e import; ajuste só testes que dependiam do comportamento errado.

**Pronto quando:** testes novos e existentes passam; nenhum código de classificação tributária perde zeros.

### T5. Upload e parse fora da transação; pool maior

**Problema:** o interceptor abre a transação antes do handler; o upload (até 15 MB) e o `XLSX.read` seguram 1 das 5 conexões.

**Passos**
1. Leia `backend/src/nest/api-access.decorators.ts` e `nest/db/` para ver como `@ProtectedApi()` compõe guards e interceptor.
2. Escolha a menor opção que não muda rotas: para `import-spreadsheet`, use um decorator que mantenha guards e rate limit **sem** o `DbContextInterceptor`, leia o arquivo e rode `parseTaxRuleSpreadsheet` + `mapTaxRuleSpreadsheetRows` antes, e chame `runWithDbContext(prisma, { tenantId, userId }, ...)` só em volta da gravação. Se essa mudança tocar muitos módulos, **pare e devolva ao `nerus-architect`**.
3. Em `lib/db/prisma.ts`, suba `max` de 5 para 10 (constante nomeada `DB_POOL_MAX`, leitura via `appConfig` com padrão 10). Confirme que o `DATABASE_URL` do Neon é o endpoint pooled; se não for, anote no PR.
4. Teste de contrato: confirme que o snapshot de rotas não mudou. Teste unitário: o parse não roda dentro de `runWithDbContext` (spy na ordem das chamadas).

**Pronto quando:** snapshot de rotas inalterado; durante o parse nenhuma transação está aberta; testes verdes.

---

## Fase B: robustez

### T6. Parser único de TTL
1. Teste primeiro em `backend/src/lib/auth/test/`: `"15m"`, `"30m"`, `"3600s"`, `"7d"`, `"12h"` → milissegundos corretos; `"abc"` e `""` → erro claro.
2. Crie `parseDurationMs(raw, fallbackMs)` em `lib/auth/config.ts` (ou arquivo vizinho), valide no startup (junto de `assertProductionSecurityConfig`), e use nas três funções (`refreshTokenTtlMs`, `passwordResetTtlMs`, `emailVerificationTtlMs`).
3. **Pronto quando:** os três TTLs usam o mesmo parser; formato inválido falha ao subir o app.

### T7. Aceitar só `.xlsx`
1. Teste primeiro: arquivo `.xls` recebe `Formato inválido. Envie um arquivo .xlsx`; `.xlsx` válido passa.
2. Em `spreadsheet-upload.ts`, remova `.xls` da extensão e da mensagem. Em `tax-rule-upload.ts`, apague a checagem de extensão duplicada (a de `validateSpreadsheetBuffer` já cobre). Procure outros usos: `grep -rn validateSpreadsheetBuffer backend/src`.
3. **Pronto quando:** uma checagem de extensão só; mensagem coerente com o comportamento.

### T8. Limitar linhas lidas no `XLSX.read`
1. Teste primeiro: planilha com mais linhas que o limite retorna erro `Planilha excede N linhas`.
2. Passe `sheetRows: MAX_TAX_RULE_SHEET_ROWS + 4` (constante nomeada, comece com 5000) para `XLSX.read`; se `matrix.length` atingir o limite, devolva erro em português.
3. **Pronto quando:** teste passa; planilhas reais de exemplo continuam importando.

### T9. Filtro `TaxRuleError` no controller inteiro
1. Verifique se `TaxRuleService.bulkUpsert` pode lançar `TaxRuleError` (`grep -n TaxRuleError`). Se não puder, **ignore a tarefa** e marque como descartada.
2. Se puder: mova `@UseFilters(taxRuleErrorFilter)` para a classe e atualize o snapshot/contrato se o status mudar de 500 para 400.

---

## Fase C: limpezas

### T10. Limpezas
- Mapper: apagar o ramo `symbolic_inbound_return` de `destinationLabel`, o parâmetro `uf` de `buildTaxPayload` e o `.map(([k, v]) => [k, v])`.
- Repository: `resolve(tenantId, params, db?: PrismaTx)` sem `unknown`/`Db`. Confira os chamadores com `grep -rn "\.resolve(" backend/src/modules`.
- **Pronto quando:** testes e `tsc` verdes, sem mudança de comportamento.

### T11. README
- Trocar "Node.js 20+" por Node 24 e a descrição de arquitetura por um resumo do `ARCHITECTURE.md` (NestJS 11 + Fastify, feature modules).

---

## Fora do escopo (não fazer agora)

- Rate limit compartilhado entre instâncias (só quando houver mais de uma instância).
- Auditoria de `modules/auth` (login, lockout, refresh), `packages/*`, `infra/fiscal-validator-proxy`, frontend e SQL das migrations: **não foram auditados**; abrir auditoria própria.

## Registro de decisões pendentes (preencher durante a execução)

| Decisão | Opções | Resposta |
|---------|--------|----------|
| T2: o `RULE_NAME` entra na identidade da regra? | Sim (muda a chave) / Não (só erro de duplicata) | Não: só reportar duplicata, chave inalterada. Causa raiz real do bug 39259090: nome `<código> - <sufixo>` sem RULE_ID não abria grupo; corrigido no parser (`isCodeWithSuffixName`). |
| T4: `"12.5"` em coluna numérica | Erro de linha / Aceitar como 12.5 | Aceitar: `"12.5"` vira 12.5; `"1.250"` continua milhar pt-BR (1250). |
| T5: abordagem | Decorator sem interceptor / outra | Decorator `@SkipDbContext()` lido pelo `DbContextInterceptor`; a rota abre o próprio `runWithDbContext` só na gravação. |

## Resultado da execução

- `runFiscalTransaction` tinha o mesmo bug da T1 (limpeza de contexto RLS em transação abortada) e foi corrigido junto.
- O gate oficial `omc ralph verify` dá falso positivo (contagens e PIDs nas assinaturas) e foi substituído pela checagem direta dos 4 comandos da verificação padrão.
- Divergência fora do escopo: `infra/docker/backend.Dockerfile` usa `node:20-alpine`, enquanto CI e frontend usam Node 24.
- Os importadores de produtos e de logística também chamam `XLSX.read` (produtos sem `sheetRows`) e merecem o mesmo teto de colunas; fora deste diff.

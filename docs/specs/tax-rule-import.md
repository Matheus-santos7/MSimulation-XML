# Importação de regras tributárias (planilha .xlsx)

Fluxo da rota de importação de regras do módulo `tax/tax-rule`. Código em
`backend/src/modules/tax/tax-rule/spreadsheet/` (parser e mapper) e specs em
`backend/src/modules/tax/tax-rule/test/`.

## Visão geral

```
upload (.xlsx, até 15 MB)
  -> parseTaxRuleSpreadsheet(buffer)      => { rawRows, errors }
  -> mapTaxRuleSpreadsheetRows(rawRows)   => { rows, errors }
  -> gravação em lote (bulkUpsert)
  -> resposta com contadores e parseErrors (erros de parser + mapper)
```

Linhas com erro são ignoradas e reportadas; as demais seguem. O frontend mostra
`parseErrors` em `frontend/src/components/tax-rule-import-form.tsx`.

## Formato da planilha

- Aba chamada **"Regras tributárias"** (aceita também sem acento, sem diferenciar maiúsculas).
- Linha 1: faixa mesclada de títulos (ignorada).
- **Linha 2: chaves das colunas** (`RULE_ID`, `RULE_NAME`, `ORIGIN`, `TRANSACTION_TYPE`,
  `IPI_ALIQUOTA`, `ICMS_<UF>_PICMS_INTERNAL`...). É o cabeçalho que o parser usa.
- Linha 3: rótulos legíveis (ignorados). Os dados começam na linha 4.
- Linhas totalmente vazias são ignoradas.

### Células mescladas e detecção de grupo

A planilha do marketplace mescla células: `RULE_ID`, `RULE_NAME` e `ORIGIN` só aparecem na
primeira linha de cada grupo de regra. As linhas seguintes (continuação) herdam esses valores.

Um **novo grupo** começa quando:

- o `RULE_ID` da linha é diferente do `RULE_ID` do cabeçalho do grupo atual; ou
- (formato legado) `RULE_ID` vazio e `RULE_NAME` numérico novo.

Em linhas de continuação o `RULE_NAME` pode trazer rótulos mais longos e a `ORIGIN` pode vir
incorreta: ambos são ignorados e vale o valor do cabeçalho do grupo. O identificador estável do
grupo é o `RULE_ID` quando `RULE_NAME` é um rótulo descritivo (formato novo); caso contrário é o
`RULE_NAME`.

Linha sem `RULE_ID`/`RULE_NAME`/`ORIGIN`/`TRANSACTION_TYPE` resolvidos gera o erro
`Linha sem RULE_ID/RULE_NAME/ORIGIN/TRANSACTION_TYPE`.

## Chave da regra

Cada linha vira uma regra com a chave:

```
<ruleId>-<UF>-<customerType>-<transactionType>
ex.: 4133250001-SP-taxpayer-sale
```

- `UF`: duas primeiras letras de `ORIGIN`, em maiúsculas (inválida => `ORIGIN inválida (esperado UF com 2 letras)`).
- `customerType`: `taxpayer` ou `non_taxpayer`, deduzido do texto de `TRANSACTION_TYPE`
  ("Não contribuinte" e "Consumidor final" => `non_taxpayer`).
- `transactionType`: `inbound` para "Envio de estoque", "Transferência" ou "Remessa"; senão `sale`.

A chave é o identificador gravado (`tenant_id` + `rule_id`). **Não mude a fórmula** sem migrar
os dados já gravados: regras existentes deixariam de ser atualizadas e seriam duplicadas.

### Regra duplicada

Se duas linhas geram a mesma chave, a **primeira é mantida** e a repetida é reportada:
`Regra duplicada: a linha N repete a chave <chave>`. Sem isso, as duas virariam o mesmo
upsert e uma sobrescreveria a outra em silêncio, com os contadores da resposta mentindo.

## Colunas numéricas e conversão de valores

Só colunas de valor/alíquota viram número. Todas as outras são **códigos** e ficam como texto
aparado, porque o zero à esquerda é significativo em código fiscal (`"000001"` de `cClassTrib`
não é `1`; `"001"` de `IPI_COD_ENQ` não é `1`). `RULE_ID` e `RULE_NAME` são sempre texto.

Colunas numéricas (constantes no topo de `tax-rule-spreadsheet.parser.ts`):

- qualquer coluna terminada em `_ALIQUOTA` ou `_REDUCAO` (`IPI_ALIQUOTA`, `PIS_ALIQUOTA`,
  `COFINS_ALIQUOTA`, `IBS_CBS_REDUCAO`);
- por UF, `ICMS_<UF>_<campo>` com campo em: `PDIF`, `PICMS_INTERNAL`, `PICMS_INTERSTATE`,
  `REDUCTION_CALC_BASE`, `REDUCTION_CALC_BASE_ST`, `REDUCTION_CALC_DIFAL`, `PICMS_FCP`,
  `PICMS_EFET`, `PREDB_CEFET`, `MVA`, `PICMSST_RET`, `PFCPST_RET`, `PCOD_BENEF_PRES`,
  `RED_ALIQ_IBS`.

Seguem como texto, entre outras: `*_ST`, `ICMS_<UF>_CST`, `COD_BENEF`, `COD_BENEF_PRES`,
`MOT_DES_ICMS`, `IBS_CBS_CCLASSTRIB`, `IPI_COD_ENQ`.

**Coluna nova no marketplace?** Se for valor/alíquota, acrescente-a às constantes
(`NUMERIC_COLUMN_SUFFIXES` ou `NUMERIC_ICMS_FIELDS`). Se não for registrada, ela é lida como
texto: o erro é visível, nunca perde zeros.

### Regras de conversão decimal

| Entrada (coluna numérica) | Resultado | Motivo |
|---|---|---|
| `12,5` | 12.5 | vírgula é o decimal pt-BR |
| `1.234,56` | 1234.56 | com vírgula, o ponto é milhar |
| `12.5` | 12.5 | ponto que não forma grupo de exatamente 3 dígitos é decimal |
| `0.00` | 0 | idem (grupo inicial com zero nunca é milhar) |
| `1.250` | 1250 | grupo de exatamente 3 dígitos após o ponto é milhar pt-BR |
| `Não aplicável`, `Calculada automaticamente` | texto mantido | valor não numérico fica como veio |

Limite conhecido: o parse usa o texto **formatado** da célula (`raw: false`), então o resultado
também depende do formato numérico da célula no Excel. Ex.: o valor 1,25 com formato `0.000`
aparece como `1.250` e vira 1250. É um risco conhecido, anterior a estas mudanças; a correção
seria ler o valor bruto das células numéricas. O formato da planilha do marketplace usa duas
casas (`0.00`, `51,11`), então o caso não ocorre hoje.

## Erros por linha (`parseErrors`)

Parser e mapper devolvem `errors: { line, message }[]`, com `line` = número da linha na
planilha. O service os repassa como `parseErrors`; as linhas válidas são gravadas mesmo assim.

| Mensagem | Origem |
|---|---|
| `Aba 'Regras tributárias' não encontrada` | parser |
| `Planilha sem linhas de dados` | parser |
| `Planilha sem cabeçalho de colunas (linha 2)` | parser |
| `Planilha excede 5000 linhas` | parser (aborta a importação inteira) |
| `Planilha excede 1000 colunas` | parser (aborta a importação inteira) |
| `Linha sem RULE_ID/RULE_NAME/ORIGIN/TRANSACTION_TYPE` | parser |
| `ORIGIN inválida (esperado UF com 2 letras)` | mapper |
| `Regra duplicada: a linha N repete a chave <chave>` | mapper |

## Limites

| Limite | Valor | Onde |
|---|---|---|
| Tamanho do arquivo | 15 MB | validação do upload |
| Linhas da aba | 5000 (`MAX_TAX_RULE_SHEET_ROWS`), contando **todas** as linhas, inclusive em branco no meio | parser; passado como `sheetRows` ao `XLSX.read` |
| Colunas da aba | 1000 (`MAX_TAX_RULE_SHEET_COLUMNS`) | parser; conferido antes de materializar a matriz |
| Formato | somente `.xlsx` | validação do upload |

O limite de linhas existe porque o `XLSX.read` carrega a aba inteira em memória antes de
qualquer validação. O parser lê uma linha além do limite apenas para distinguir "exatamente
5000" (aceita) de "mais de 5000" (rejeita).

## Gravação em lote (bulkUpsert)

Código: `tax-rule.repository.ts` (`bulkUpsert` e `upsertBatch`).

1. Deduplica por `ruleId`; a **última** ocorrência vence.
2. Faz um `findMany` prévio dos `ruleId` já gravados para o tenant (base dos contadores).
3. Grava com **1 `INSERT ... ON CONFLICT (tenant_id, rule_id) DO UPDATE`** por lote de 500 linhas
   (`UPSERT_BATCH_SIZE`), passando um array por coluna e expandindo com `unnest`. 3.000 linhas
   = 6 comandos de INSERT mais o `findMany`.
4. No `DO UPDATE`, as colunas opcionais usam `COALESCE`: `transaction_type`, `customer_type`,
   `origin` e `payload` vazios na importação **preservam** o valor já gravado.

Contadores da resposta:

- `total` = linhas **depois** de deduplicar.
- `created` / `updated` vêm do `findMany` prévio. Se dois imports do mesmo tenant rodarem ao
  mesmo tempo, a contagem pode errar; os dados gravados ficam corretos.
- Na planilha, o mapper já rejeita chaves repetidas (a primeira vence e a repetição vira erro de
  linha), então a deduplicação do repository (última vence) só age na rota JSON
  `POST /tax-rules/bulk-upsert`, onde `total` também conta só linhas únicas.

**Acoplamento ao schema:** o INSERT é SQL cru ligado às colunas de `tax_rules`. Coluna nova
(ou removida, ou de tipo diferente) exige atualizar a lista do `INSERT`, o `unnest` e o
`DO UPDATE`. O Prisma não valida SQL cru: uma coluna `NOT NULL` esquecida só falha em tempo de
execução.

## Transação e pool de conexões

Fluxo da rota de importação (`tax-rule.controller.ts` e `tax-rule.service.ts`):

```
guards -> rate limit -> handler SEM transação (@SkipDbContext())
  -> lê o upload e valida (.xlsx, 15 MB, magic bytes)
  -> parse e map, só em memória
  -> nada sobrou? 400
  -> runWithDbContext(prisma, { tenantId, userId }) só em volta do bulkUpsert
```

**Por que sair da transação:** o `DbContextInterceptor` normalmente abre a transação antes do
handler. Com isso, o upload e o `XLSX.read` (segundos, até 15 MB) seguravam 1 das conexões do
pool sem fazer nenhuma consulta. Com `@SkipDbContext()` a rota não abre transação no
interceptor e a conexão só é tomada durante a gravação. Dentro do handler, `getDbClient()` fora
do `runWithDbContext` lança erro.

**`DB_POOL_MAX`** (`config.service.ts`, `dbPoolMax`): tamanho máximo do pool do Prisma.

- Padrão 10; precisa ser inteiro positivo. Valor inválido derruba o boot.
- Em produção use o endpoint **pooled** do Neon.
- A soma `DB_POOL_MAX` x número de instâncias deve caber no limite de conexões do plano.

## Agrupamento de regras na planilha

Só o **primeiro** grupo de linhas de uma regra traz `RULE_ID`. Os demais vêm com `RULE_ID`
vazio e `RULE_NAME` no formato `"<código> - <sufixo>"` (ex.: `"39259090 - IMPORTADO"`). Esse
formato abre um grupo novo (função `isCodeWithSuffixName` no parser). Um rótulo de continuação
sem `" - "` é ignorado e a linha segue no grupo atual.

Resultado medido na planilha real ML 23-10: 468 linhas viram **462 regras** e 6 linhas
duplicadas verdadeiras (`82055900` e `"82055900 - IMPORTADO"` aparecem duas vezes, com conteúdo
idêntico), reportadas como `Regra duplicada` com a primeira mantida. A causa raiz do bug do
`39259090` era justamente esse nome sem `RULE_ID`, que não abria grupo.

## Teto de colunas

`MAX_TAX_RULE_SHEET_COLUMNS` = 1000 (parser). O `sheetRows` só corta linhas; uma planilha de
8,6 KB com uma célula em `XFD` (última coluna do Excel) travava o `XLSX.read` por ~110 s e usava
1,4 GB. O parser confere a faixa declarada antes de materializar a matriz e devolve
`Planilha excede 1000 colunas`.

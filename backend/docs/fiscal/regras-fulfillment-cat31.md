# Regras Fiscais: Fulfillment e Operador Logístico (Portaria CAT 31/2019 — SP)

Esta documentação detalha as regras de emissão de Nota Fiscal Eletrônica (NF-e) para operações logísticas de armazenamento e despacho por terceiros (Fulfillment — Mercado Envios Full, Amazon Fulfillment, etc.) no estado de São Paulo, regidas pela **Portaria CAT 31/2019**.

> **`<infCpl>` (texto gerado):** a composição canônica (ASCII, head + miolo + regime EBazar) está em
> [`docs/specs/infcpl-fulfillment-ebazar.md`](../../../docs/specs/infcpl-fulfillment-ebazar.md)
> e no composer `buildFulfillmentInfCplText` (`@msimulation-xml/fiscal-core`).
> Os blocos abaixo descrevem a obrigação fiscal; o texto literal emitido segue a spec.

---

## 1. Inbound (Envio de Estoque para o Fulfillment)

Ocorre quando o **Vendedor (Depositante)** envia seus produtos fisicamente para o galpão do **Operador Logístico**.

### Emissão da NF-e (Artigo 5º)

| Campo | Valor |
|-------|-------|
| **Tipo de Nota** | Saída (`tpNF = 1`) |
| **Destinatário** | Operador Logístico (CNPJ, IE e endereço do CD) |
| **CFOP** | `5949` |
| **Natureza da Operação** | Outras Saídas — Remessa para Depósito Temporário |

### Destaque de Impostos (ICMS)

- **Regime Normal (RPA):** exige destaque do ICMS.
- **Simples Nacional:** não há tributação nesta etapa; a tributação ocorre apenas na venda final.

### Informações Complementares (`<infCpl>`)

```
Remessa para armazenamento em fulfillment. Inscricao Estadual do Operador Logistico: {IE}. [Regime Especial {UF} - ...]?
```

---

## 2. Venda / Outbound (Despacho para o Cliente Final)

Quando o produto é vendido e despachado diretamente do armazém do Operador Logístico para o consumidor, o sistema do Vendedor deve emitir **duas notas fiscais simultâneas**.

### 2.1. Nota de Venda (Artigo 7º, Inciso I)

| Campo | Valor |
|-------|-------|
| **Tipo de Nota** | Saída (`tpNF = 1`) |
| **Destinatário** | Comprador / Consumidor Final |
| **CFOP** | Padrão de venda conforme árvore (`packages/fiscal-core` `resolveCfopByDecisionTree`): Full/armazém geral → `5105`/`6105` (indústria) ou `5106`/`6106` (comércio); estoque próprio → `5101`/`5102`/`6101`/`6102`/`6107`/`6108`; ST → `5405`/`6403`/`6404`. Ver `docs/specs/sale-fulfillment-cfop-matrix.md`. |
| **ICMS** | Destacado ou pago no Simples Nacional normalmente |

**Local de Retirada (`<retirada>`):** preencher o XML com endereço, CNPJ e Inscrição Estadual do Operador Logístico (o produto sai de lá).

**Informações Complementares (`<infCpl>`):**

```
Venda de mercadoria armazenada em fulfillment. {miolo CD + retorno simbolico + IBPT + DIFAL}. [Regime Especial {UF CD} - ...]?
```

### 2.2. Nota de Retorno Simbólico (Artigo 7º, Inciso II e Artigo 6º)

Emissão necessária para dar baixa contábil no estoque que estava no armazém.

| Campo | Valor |
|-------|-------|
| **Tipo de Nota** | Entrada (`tpNF = 0`) |
| **Emitente** | O próprio Vendedor contra o Operador Logístico |
| **CFOP** | `1949` |
| **Natureza da Operação** | Outras Entradas — Retorno Simbólico de Depósito Temporário |

**Notas Referenciadas (`<refNFe>`):** chave(s) de acesso da(s) NF-e(s) originais de Remessa (Inbound — § 1) relativas aos itens vendidos.

**Informações Complementares (`<infCpl>`):**

```
Retorno simbolico de mercadoria armazenada em fulfillment. [Regime Especial {UF} - ...]?
```

---

## 3. Retorno Físico (Remoção de Estoque do Fulfillment) — `RETORNO_FISICO`

Quando o Vendedor solicita a devolução física do estoque que estava no CD.

### Emissão da NF-e (Artigo 6º)

| Campo | Valor |
|-------|-------|
| **Tipo de Nota** | Entrada (`tpNF = 0`) |
| **Emitente** | Vendedor (Depositante), para acobertar o trânsito do CD de volta à sede |
| **CFOP** | `1949` |
| **Natureza da Operação** | Outras Entradas — Retorno de Depósito Temporário |
| **Tipo sistema** | `RETORNO_FISICO` |

**Notas Referenciadas (`<refNFe>`):** chaves de acesso das NF-es originais de remessa para depósito (Inbound).

**Informações Complementares (`<infCpl>`):**

```
Retorno fisico de mercadoria armazenada em fulfillment. [Regime Especial {UF} - ...]?
```

---

## 4. Logística Reversa (Devolução pelo Consumidor ao Fulfillment)

Se o consumidor pessoa física não contribuinte devolver o produto e o mesmo for entregue diretamente no galpão do Operador Logístico (**Artigo 11**), também exige **duas notas fiscais**.

### 4.1. Nota de Entrada (Devolução da Venda) — `DEVOLUCAO`

| Campo | Valor |
|-------|-------|
| **Tipo de Nota** | Entrada (`tpNF = 0`) |
| **Emissor / Destinatário** | Vendedor emitindo contra o Consumidor |
| **CFOP** | Padrão de devolução de venda (ex.: `1202`, `2202`) |
| **Impostos** | Estorno de impostos cabíveis |

**Notas Referenciadas (`<refNFe>`):** chave de acesso da Nota de Venda original.

**Informações Complementares (`<infCpl>`):**

```
Devolucao de mercadoria referente a NF-e de origem n {numero} serie {serie} emitida em {dd/mm/aaaa}. [Regime Especial {UF CD} - ...]?
```

### 4.1-bis. Insucesso de entrega — `INSULCESSO_DE_ENTREGA`

Mesma estrutura de devolução (entrada contra o consumidor / NF-e de origem), quando a mercadoria retorna por **insucesso de entrega**.

> **Nomenclatura:** o enum Prisma / API usa a grafia pedida `INSULCESSO_DE_ENTREGA`; o texto ASCII emitido em `<infCpl>` usa português correto sem acento: **Insucesso de entrega…**.

```
Insucesso de entrega de mercadoria referente a NF-e de origem n {numero} serie {serie} emitida em {dd/mm/aaaa}. [Regime Especial {UF CD} - ...]?
```

### 4.2. Remessa Simbólica de Devolução (Retorno ao Estoque do CD)

Para incluir contabilmente o produto devolvido de volta ao controle de estoque de terceiros no Fulfillment.

| Campo | Valor |
|-------|-------|
| **Tipo de Nota** | Saída (`tpNF = 1`) |
| **Destinatário** | Operador Logístico |
| **CFOP** | `5949` |
| **Natureza da Operação** | Outras Saídas — Remessa Simbólica para Depósito Temporário |

**Notas Referenciadas (`<refNFe>`):** chave de acesso da Nota de Entrada por devolução (§ 4.1).

**Informações Complementares (`<infCpl>`):**

```
Remessa simbolica para armazenamento em fulfillment. Inscricao Estadual do Operador Logistico: {IE}. Nota fiscal de devolucao n {n} emitida em {data} serie {serie}. [Regime Especial {UF} - ...]?
```

---

## 5. Regimes especiais EBazar (sufixo do `<infCpl>`)

Quando `ufDestino` (UF da filial/CD) + `cnpjFilial` casam o mapa da spec, o composer acrescenta o texto do regime (BA, SC, RJ, MG, DF, RS, PR, PE). Ver tabela completa na spec.

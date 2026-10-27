# Regras de Estruturação e Cálculo XML - NF-e / NFC-e (MOC 7.0)

Este documento contém as especificações e critérios técnicos exigidos pela SEFAZ para a estruturação do arquivo XML e cálculos matemáticos da Nota Fiscal Eletrônica (NF-e, modelo 55) e Nota Fiscal de Consumidor Eletrônica (NFC-e, modelo 65).

## 1. Padrões de Estruturação do Arquivo XML

### 1.1. Codificação e Cabeçalho

* **Encoding:** A codificação de caracteres deve ser estritamente `UTF-8`.
* **Declaração:** Todo documento deve iniciar obrigatoriamente com a declaração única: `<?xml version="1.0" encoding="UTF-8"?>`.
* **Vedação de Múltiplas Declarações:** Mesmo em Lotes, o arquivo XML final só pode conter esta declaração uma única vez no topo do arquivo.

### 1.2. Namespaces (Regra de Otimização)

* O documento XML deve ter uma **única declaração de namespace** no elemento raiz.
* **Prefixo Proibido:** É expressamente vedado o uso de prefixos de namespace para otimizar o tamanho do arquivo.
* ❌ Incorreto: `<NFe xmlns:nfe="http://www.portalfiscal.inf.br/nfe">`
* ✅ Correto: `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`


* A declaração do namespace da assinatura digital deve ficar restrita à própria tag `<Signature>`.

### 1.3. Otimização e Limpeza de Tags (Shrink)

Para reduzir o tamanho final do XML e evitar rejeições de Schema, o gerador de XML **deve** aplicar as seguintes regras de supressão:

1. **Tags Vazias:** Não incluir a TAG de campo opcional com conteúdo vazio (para alfanuméricos) ou conteúdo zerado (para numéricos).
2. **Zeros não significativos:** Não incluir zeros à esquerda não significativos em campos numéricos.
3. **Espaçamento:** Não incluir espaços no início ou no final de campos (`trim` obrigatório).
4. **Comentários/Formatação:** Não incluir tags de anotação (`annotation`, `documentation`), comentários XML (``), ou caracteres de formatação de quebra de linha/tabulação (line-feed, carriage return, tab) entre as tags.

### 1.4. Tratamento de Caracteres Especiais (Escape)

Caracteres que quebram o "parser" XML devem ser substituídos (escapados) sempre que presentes em campos de texto livre (Ex: Razão Social, Informações Adicionais):

* `<` (sinal de menor) ➔ `&lt;`
* `>` (sinal de maior) ➔ `&gt;`
* `&` (e-comercial) ➔ `&amp;`
* `"` (aspas duplas) ➔ `&quot;`
* `'` (apóstrofe) ➔ `&#39;`
*(Nota: A sequência de escape conta como 1 único caractere na validação de tamanho de campo do Schema).*

---

## 2. Assinatura Digital (XML Digital Signature)

A assinatura da NF-e segue o padrão `XML Digital Signature` (Formato `Enveloped`), utilizando RSA com SHA-1 e certificação ICP-Brasil (A1 ou A3).

### 2.1. Regras de Montagem

* A assinatura deve ser feita sobre o atributo `Id` da tag `<infNFe>`. O conteúdo deste `Id` deve ser o prefixo `NFe` seguido da Chave de Acesso de 44 posições (Ex: `Id="NFe352001..."`).
* A tag `<Reference>` deve referenciar este URI. Ex: `<Reference URI="#NFe352001...">`.
* **Tags Proibidas:** O XML **não deve** conter os seguintes elementos (são obtidos direto do certificado e causam inchaço no XML):
* `<X509SubjectName>`, `<X509IssuerSerial>`, `<X509IssuerName>`, `<X509SerialNumber>`, `<X509SKI>`, `<KeyValue>`, `<RSAKeyValue>`, `<Modulus>`, `<Exponent>`.



### 2.2. Algoritmos e Transformações Exigidos

* **Canonicalization:** `http://www.w3.org/TR/2001/REC-xml-c14n-20010315`
* **SignatureMethod:** `http://www.w3.org/2000/09/xmldsig#rsa-sha1`
* **DigestMethod:** `http://www.w3.org/2000/09/xmldsig#sha1`
* **Transforms:** Deve conter OBRIGATORIAMENTE duas transformações:
1. `http://www.w3.org/2000/09/xmldsig#enveloped-signature`
2. `http://www.w3.org/TR/2001/REC-xml-c14n-20010315`



---

## 3. Algoritmos e Dígitos Verificadores

### 3.1. Chave de Acesso (44 Posições) e Módulo 11

A chave é montada pela concatenação: `cUF(2)` + `AAMM(4)` + `CNPJ_CPF(14)` + `mod(2)` + `serie(3)` + `nNF(9)` + `tpEmis(1)` + `cNF(8)` + `cDV(1)`.

**Cálculo do Dígito Verificador (cDV) - Módulo 11:**

1. Ponderação: da direita para a esquerda, multiplique cada algoritmo da chave (sem o DV) pela sequência de pesos `2, 3, 4, 5, 6, 7, 8, 9, 2, 3...` sucessivamente.
2. Soma: some os resultados das multiplicações.
3. Resto: divida a soma por `11` e guarde o resto.
4. DV: `11 - Resto`.
* **Regra Especial:** Se o resto for `0` ou `1`, o dígito verificador (DV) é OBRIGATORIAMENTE `0` (zero).



### 3.2. Código do Município IBGE (Módulo 10)

A validação do Código IBGE de 7 dígitos (`UUNNNND`) utiliza Módulo 10 nos 6 primeiros dígitos:

1. Pesos: `1, 2, 1, 2, 1, 2` (da esquerda para a direita).
2. Ponderação: Se a multiplicação resultar em número `> 9`, some os algarismos (Ex: `5 * 2 = 10` ➔ `1 + 0 = 1`).
3. Soma: Some todos os resultados das ponderações.
4. Resto: Soma dividida por `10`.
5. DV: `10 - Resto` (Se resto for 0, DV = 0).

### 3.3. Código de Segurança do Responsável Técnico (hashCSRT)

Implementado para atestar a autoria do software emissor.

1. **Passo 1:** Concatenar o código CSRT com a Chave de Acesso (44 dígitos). Ex: `CSRT411806...`.
2. **Passo 2:** Gerar o Hash SHA-1 em cima dessa string (gera 20 bytes/40 caracteres hexadecimais).
3. **Passo 3:** Converter o Hexadecimal do SHA-1 para **Base64** (resulta em uma string de 28 caracteres).
4. **Passo 4:** Injetar na tag `<hashCSRT>` do grupo `<infRespTec>`.

---

## 4. Sistemática de Cálculo - EC 87/2015 (DIFAL e FCP)

Abaixo constam as fórmulas matemáticas exatas para processamento do ICMS Partilhado em operações interestaduais para **Consumidor Final Não-Contribuinte** (Grupo `<ICMSUFDest>`), conforme exemplificado no MOC:

### 4.1. Definição das Variáveis

* **`BC`**: Base de Cálculo do ICMS da operação.
* **`ALQ INTER`** (`pICMSInter`): Alíquota Interestadual (4%, 7% ou 12%).
* **`ALQ INTRA`** (`pICMSUFDest`): Alíquota Interna adotada no estado de destino.
* **`ALQ FCP`** (`pFCPUFDest`): Percentual do Fundo de Combate à Pobreza no destino.

### 4.2. Cálculos por Item

Os impostos a seguir devem ser calculados individualmente a nível de `<det>` (item):

```text
// 1. ICMS PRÓPRIO DA ORIGEM (Truncar o resultado)
ICMS_ORIGEM = Truncar( BC * (ALQ_INTER / 100) )

// 2. CÁLCULO DA DIFERENÇA DE ALÍQUOTA (DIFAL TOTAL)
ICMS_DIFAL_TOTAL = (BC * (ALQ_INTRA / 100)) - (BC * (ALQ_INTER / 100))

// 3. FCP NO DESTINO
vFCPUFDest = BC * (ALQ_FCP / 100)

// 4. PARTILHA DO DIFAL (Exemplo com 100% Destino na regra atual, 
// no MOC está o histórico de 40%/60% de 2016)
vICMSUFDest (Parte Destino) = ICMS_DIFAL_TOTAL * (PERCENTUAL_PARTILHA_DESTINO / 100)
vICMSUFRemet (Parte Origem) = ICMS_DIFAL_TOTAL * (PERCENTUAL_PARTILHA_ORIGEM / 100)

```

### 4.3. Somatórios do Total da Nota (Grupo `ICMSTot`)

O XML final deve conter as tags totalizadoras como o sumário exato dos itens calculados acima:

* `<vFCPUFDest>` = `Soma(vFCPUFDest dos itens)`
* `<vICMSUFDest>` = `Soma(vICMSUFDest dos itens)`
* `<vICMSUFRemet>` = `Soma(vICMSUFRemet dos itens)`
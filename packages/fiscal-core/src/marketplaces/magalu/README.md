# Magalu

Perfil `PENDENTE_CONFIGURACAO`: o faturamento responde 422 "Marketplace ainda não configurado para faturamento".

XMLs reais para análise: `XMLs/marketplaces/magalu/` (fora do git).

## Para ativar

Preencha, com base nos XMLs reais, os mesmos arquivos da pasta `mercado-livre/`:

| Arquivo                                       | O que levantar                                        |
| --------------------------------------------- | ----------------------------------------------------- |
| `intermediador.ts`                            | CNPJ do intermediador e `idCadIntTran`                |
| `responsavel-tecnico.ts`                      | Bloco `<infRespTec>`, se o marketplace exigir         |
| `aut-xml.ts`                                  | CPFs/CNPJs do `<autXML>`                              |
| `transporte.ts`                               | Transportador de remessa e de venda, `modFrete`       |
| `tributos.ts`                                 | IBS/CBS padrão                                        |
| `ide.ts`                                      | `natOp` e `verProc` da venda                          |
| `armazem.ts`                                  | CDs de fulfillment (razão social, CNPJ, IE, endereço) |
| `textos.ts`                                   | `<infCpl>` e `<obsCont>` exigidos                     |
| `fulfillment-payload.ts` / `venda-payload.ts` | Enriquecimento do `fiscalPayload`                     |

Depois: troque o `status` para `ATIVO`, adicione um cenário por tipo de nota em `packages/nfe-xml/src/golden/golden-scenarios.ts` e grave os XMLs de referência.

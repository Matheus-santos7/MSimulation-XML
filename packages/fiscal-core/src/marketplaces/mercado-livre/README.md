# Mercado Livre

Perfil `ATIVO`. As regras vêm dos XMLs reais de fulfillment (Full) usados como referência no simulador.

| Arquivo                  | Bloco do XML        | Conteúdo                                                                   |
| ------------------------ | ------------------- | -------------------------------------------------------------------------- |
| `intermediador.ts`       | `<infIntermed>`     | CNPJ 03007331000141 (EBAZAR.COM.BR LTDA) e `idCadIntTran` padrão 279642028 |
| `responsavel-tecnico.ts` | `<infRespTec>`      | Contato fiscal do ML; `hashCSRT` diferente na venda e na remessa           |
| `aut-xml.ts`             | `<autXML>`          | CPFs padrão quando a empresa não informa                                   |
| `transporte.ts`          | `<transporta>`      | Transgoss na remessa; EBAZAR (Osasco) na venda                             |
| `tributos.ts`            | `<IBSCBS>`          | CST 410 na remessa; 000 na venda                                           |
| `ide.ts`                 | `<ide>`             | `natOp` e `verProc` da venda                                               |
| `armazem.ts`             | `<infCpl>` da venda | CD de Governador Celso Ramos (SC) quando o retorno não traz o destinatário |
| `textos.ts`              | `<obsCont>`         | Sufixo `OLSS-<idCadIntTran>` do `external_id`                              |
| `fulfillment-payload.ts` | —                   | Enriquecimento de remessa, retorno e transferência                         |
| `venda-payload.ts`       | —                   | Enriquecimento da venda (`infCpl`, `infAdProd`, cartão, volumes)           |

Os XMLs gerados com estas regras estão fixados em `packages/nfe-xml/src/golden/fixtures/mercado-livre-*.xml`. Qualquer mudança aqui que altere um deles aparece no teste de referência.

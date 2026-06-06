# Services — mapa de responsabilidades

| Arquivo | Responsabilidade |
|---------|------------------|
| `remessa-service.ts` | NF-e de remessa física (CFOP 6949), saldo inicial, CT-e remessa, XML persistido |
| `nfe-xml-service.ts` | Gera/grava `xmlAutorizado`; `GET /nfes/:chave/xml` |
| `remessa-fifo.ts` | Saldo FIFO entre remessas; consumo no retorno; estorno |
| `venda-chain-service.ts` | Fachada: retorno + venda + CT-e venda; XML persistido em `emit-venda` / `emit-retorno` |
| `devolucao-service.ts` | Devolução da venda, estorno FIFO, remessa simbólica, XML persistido |
| `cancelamento-service.ts` | Evento 110111; cancela venda e retorno referenciado |
| `inutilizacao-service.ts` | Faixa de numeração inutilizada (sem NF-e na série) |
| `cte-remessa-service.ts` | CT-e vinculado à NF-e de remessa |
| `cte-venda-service.ts` | CT-e vinculado à NF-e de venda |
| `checkout-service.ts` | Checkout direto → `emitirCadeiaVenda` |
| `pedido-service.ts` | Rascunho de pedido + faturamento |
| `timeline-service.ts` | Agrupa NF-es em cadeias para o dashboard |
| `fiscal-service.ts` | Soft delete de NF-e / CT-e |
| `tax-rule-service.ts` | Resolve regra da planilha (origem × destino × tipo) |
| `tax-calculation-service.ts` | Monta item + chama `tax-engine` |
| `fiscal-emitter-settings-service.ts` | Configurações do emissor (hub ML) |

## Plugins HTTP (contextos)

| Plugin | Rotas |
|--------|-------|
| `contexts/org` | tenants, users |
| `contexts/catalog` | products |
| `contexts/fiscal` | fiscal, fiscal-settings, pedidos |
| `contexts/logistics` | unidades-logisticas |

Guia de estilo: [docs/COMENTARIOS.md](../../docs/COMENTARIOS.md).

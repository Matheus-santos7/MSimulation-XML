# Services — mapa por domínio

Services espelham a organização de `routes/` e `schemas/`. Handlers HTTP importam diretamente do arquivo `*-service.ts` ou do `index.ts` da pasta.

## `auth/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `auth-service.ts` | Login, registro, refresh, onboarding |
| `two-factor-service.ts` | TOTP 2FA |
| `password-reset-service.ts` | Reset de senha |
| `email-verification-service.ts` | Confirmação de e-mail |
| `email-service.ts` | Envio via Resend |

## `org/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `tenant-service.ts` | CRUD de tenants |
| `user-service.ts` | Gestão de usuários |

## `catalog/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `product-service.ts` | Produtos, bulk upsert |

## `lookup/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `lookup-service.ts` | CNPJ e CEP (BrasilAPI) |

## `logistics/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `unidade-logistica-service.ts` | CDs Mercado Livre Full por tenant |
| `movimentacao-produto-service.ts` | Histórico de movimentações |
| `avanco-cd-service.ts` | Avanço entre CDs + remessa |

## `fiscal/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `remessa-service.ts` | NF-e de remessa física (CFOP 6949), saldo inicial, CT-e remessa, XML persistido |
| `nfe-xml-service.ts` | Gera/grava `xmlAutorizado`; `GET /nfes/:chave/xml` |
| `remessa-fifo.ts` | Saldo FIFO entre remessas; consumo no retorno; estorno |
| `venda-chain-service.ts` | Fachada: retorno + venda + CT-e venda |
| `venda-chain/` | Submódulo: `emit-retorno`, `emit-venda`, `emit-cadeia`, … |
| `devolucao-service.ts` | Devolução da venda, estorno FIFO, remessa simbólica |
| `cancelamento-service.ts` | Evento 110111; cancela venda e retorno referenciado |
| `inutilizacao-service.ts` | Faixa de numeração inutilizada |
| `cte-remessa-service.ts` | CT-e vinculado à NF-e de remessa |
| `cte-venda-service.ts` | CT-e vinculado à NF-e de venda |
| `checkout-service.ts` | Checkout direto → `emitirCadeiaVenda` |
| `pedido-service.ts` | Rascunho de pedido + faturamento |
| `timeline-service.ts` | Agrupa NF-es em cadeias para o dashboard |
| `fiscal-service.ts` | Soft delete de NF-e / CT-e |
| `tax-rule-service.ts` | Resolve regra da planilha (origem × destino × tipo) |
| `tax-rule-catalog-service.ts` | CRUD e importação de regras |
| `tax-calculation-service.ts` | Monta item + chama `tax-engine` |
| `fiscal-emitter-settings-service.ts` | Configurações do emissor (hub ML) |
| `remessa-simbolica-fiscal.ts` | Payload fiscal da remessa simbólica |

## Plugins HTTP (contextos)

| Plugin | Rotas | Services |
|--------|-------|----------|
| `contexts/org` | tenants, users | `org/` |
| `contexts/catalog` | products | `catalog/` + `fiscal/remessa-service` |
| `contexts/fiscal` | nfes, pedidos, settings, tax-rules | `fiscal/` |
| `contexts/logistics` | unidades-logisticas, movimentacoes | `logistics/` |

Guia de estilo: [docs/COMENTARIOS.md](../../docs/COMENTARIOS.md).

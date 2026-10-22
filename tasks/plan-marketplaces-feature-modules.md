# Plano — feature modules e suporte a vários marketplaces

Levantado no código em 2026-10-22, a partir de `test/http-contract-baseline` (d40248c).

## Objetivo

1. Levar os módulos `health`, `lookup`, `fiscal-settings`, `tax`, `catalog`, `logistics`, `org`, `fiscal-validation`, `fiscal-documents`, `sales` e `auth` (e `remessas`, que o `sales` usa por dentro) para a estrutura do `.claude/ARCHITECTURE.md`.
2. Tornar o marketplace um conceito do sistema: Mercado Livre, Shopee, Amazon e Magalu.
3. Gerar as NF-e (remessa, venda, retorno, devolução, transferência) no formato de cada marketplace.
4. Configuração do faturador por marketplace: padrão da empresa + sobrescrita por marketplace.
5. O pedido nasce com o marketplace que vai faturá-lo.

## Decisões (respondidas em 2026-10-22)

| Pergunta | Decisão |
|---|---|
| Configuração do faturador | Padrão da empresa + sobrescrita por marketplace. Marketplace sem sobrescrita usa o padrão |
| XML | Só gerar. Importar XML de marketplace fica para depois |
| Marketplace sem regras conhecidas | Faturamento bloqueado: 422 `"Marketplace ainda não configurado para faturamento"` |
| Frontend | Entra o mínimo: marketplace no pedido, configuração fiscal por marketplace, unidades logísticas por marketplace |

## Ponto de partida

| Item | Hoje |
|---|---|
| Tamanho | ~27 mil linhas nos 12 módulos; 50 arquivos de teste no backend |
| Acoplamento ao ML | 669 linhas em 124 arquivos (`Meli*`, `*Ml*`, `ML_*`); `pedidoMl` em 47 arquivos |
| Constantes fixas | CNPJ do intermediador e `idCadIntTran` (`remessa-ml-payload.ts`), `autXML` e `infRespTec` da EBAZAR, sufixo OLSS do `obsCont` (`nfe-xtexto.ts`) |
| Ponto de injeção | `enrichFiscalPayloadMlFulfillment` (5 chamadas: remessa física, simbólica, transferência, fiscal-emissor-adapter, nota de retorno) e `builders/nodes/auxiliary.node.ts` do `nfe-xml` |
| Configuração fiscal | `fiscal_emitter_settings`: um JSON por empresa (`tenant_id` único). `formaFaturamento: "EMISSOR_PROPRIO" \| "EMISSOR_ML"`; `modalidadeFrete` com Full/Coleta/Flex/Turbo |
| Pedido | `pedidos.pedido_ml` (pack id), `pedido_itens.x_ped` (order id por item). Sem marketplace |
| Nota | `nfes.pedido_ml`, `unidade_destino_id` → `meli_unidades_logisticas` |
| Unidades | `meli_unidades_logisticas` global (CDs do ML, destinatário padrão `EBAZAR.COM.BR LTDA`) + vínculo por empresa |
| Estrutura | Camadas `domain/`, `application/`, `infrastructure/`, `presentation/`; Zod; `node:test`; DI por `@Inject(TOKEN)` + `create<Ctx>Module()` |

## Desenho alvo

### 1. Marketplace como perfil fiscal (`packages/fiscal-core`)

Regra fiscal pura, sem Nest nem Prisma, usada pelo backend e pelo `nfe-xml`. Uma pasta por marketplace, todas com os mesmos arquivos, para que a diferença entre elas fique visível:

```
packages/fiscal-core/src/marketplaces/
  marketplace.ts                 # enum Marketplace { MERCADO_LIVRE, SHOPEE, AMAZON, MAGALU }
  marketplace-fiscal-profile.ts  # interface MarketplaceFiscalProfile
  registry.ts                    # getMarketplaceProfile(code), listMarketplaceProfiles()
  mercado-livre/
    profile.ts                   # status ATIVO; junta os arquivos abaixo
    intermediador.ts             # CNPJ 03007331000141, idCadIntTran padrão
    responsavel-tecnico.ts       # infRespTec de venda e de remessa
    aut-xml.ts                   # CPFs padrão do autXML
    textos.ts                    # obsCont / xTexto (OLSS), infCpl
    pedido.ts                    # formato do pack id e do xPed por item
    frete.ts                     # modalidades: fulfillment, coleta, flex, turbo
    armazem.ts                   # destinatário fiscal padrão (EBAZAR), transportador da remessa
    README.md                    # de onde vem cada regra (XMLs de referência)
  shopee/  amazon/  magalu/
    profile.ts                   # status PENDENTE_CONFIGURACAO; campos ainda não conhecidos ficam null
    README.md                    # checklist do que falta levantar (seção "O que preciso de você")
```

`MarketplaceFiscalProfile` (rascunho):

```ts
export interface MarketplaceFiscalProfile {
  code: Marketplace;
  nome: string;
  status: "ATIVO" | "PENDENTE_CONFIGURACAO";
  intermediador: { cnpj: string; idCadIntTranPadrao: string | null } | null;
  responsavelTecnico: { venda: InfRespTec | null; remessa: InfRespTec | null };
  autXmlCpfsPadrao: readonly string[];
  pedido: { validarId(id: string): boolean; xPedPorItem: boolean };
  textos: { obsCont(input: ObsContInput): ObsCont | null; infCpl(input: InfCplInput): string | null };
  frete: { modalidades: readonly ModalidadeFreteMarketplace[] };
  armazem: { destNomeFiscalPadrao: string | null; transportadorRemessa: Transporta | null };
}
```

`enrichFiscalPayloadMlFulfillment` vira `enrichFiscalPayloadForMarketplace(payload, { profile, settings })`. O `nfe-xml` para de importar constantes `ML_*` e lê tudo de `ctx.marketplace`.

Garantia: para o Mercado Livre, o XML gerado tem que ser idêntico byte a byte ao de hoje. Antes de mexer, gravo XMLs de referência (golden files) de cada tipo de nota com entradas fixas.

### 2. Configuração do faturador por marketplace

```
fiscal_emitter_settings              (já existe) padrão da empresa, 1 por tenant
marketplace_billing_settings         (nova)      tenant_id, marketplace, overrides Json, created_at, updated_at
                                                 unique (tenant_id, marketplace), RLS tenant_isolation
```

- `overrides` é um `Partial` profundo de `FiscalEmitterSettingsData` + um bloco `marketplace` (`idCadIntTran`, `autXmlCpfs`, `mensagemPadrao`, numeração/série própria).
- Configuração efetiva = `deepMerge(padrão, overrides)`, calculada num só lugar: `ResolveBillingSettingsUseCase(tenantId, marketplace)`. Toda emissão usa o resultado; nenhum módulo lê `fiscal_emitter_settings` direto.
- `formaFaturamento` vira `"EMISSOR_PROPRIO" | "EMISSOR_MARKETPLACE"`. O valor antigo `EMISSOR_ML` é convertido na leitura e na migration.
- `modalidadeFrete` sai das chaves fixas (`fullfilmentVendas`, `flex`, `turbo`...) e passa a ser um mapa indexado pelas modalidades do perfil do marketplace.
- API: `GET /api/fiscal-settings` (padrão, como hoje), `GET|PUT /api/fiscal-settings/marketplaces/:marketplace` (sobrescrita), `GET /api/fiscal-settings/marketplaces/:marketplace/efetiva` (resultado do merge, para a tela mostrar o que é herdado).

### 3. Pedido, nota e unidade com marketplace

| Tabela | Mudança |
|---|---|
| `pedidos` | `marketplace` (enum, obrigatório); `pedido_ml` → `marketplace_order_id` |
| `nfes` | `marketplace` (enum, obrigatório); `pedido_ml` → `marketplace_order_id` |
| `meli_unidades_logisticas` | vira `unidades_logisticas` + `marketplace`; `codigo` e `cnpj` passam a ser únicos por marketplace |
| `pedido_itens.x_ped` | continua; a validação passa a vir do perfil |

- Linhas existentes recebem `MERCADO_LIVRE` na migration.
- `POST /api/pedidos` exige `marketplace`; o id do pedido é validado pelo perfil.
- `POST /api/pedidos/:id/faturar` resolve o perfil. Se o status for `PENDENTE_CONFIGURACAO`, responde 422 sem tocar no banco.
- Saldo de remessa (FIFO) passa a ser por marketplace: venda da Shopee não consome estoque enviado ao Full do ML. A remessa herda o marketplace da unidade de destino.
- `GET /api/marketplaces` lista código, nome e status, para o frontend montar o seletor.

### 4. Estrutura dos módulos

Dois níveis, para os módulos grandes não virarem uma pasta com 60 arquivos: `modules/<contexto>/<feature>/`, cada feature no formato do contrato (`<feature>.module.ts`, controller, service, repository, `dtos/`, `use-cases/`, `errors/`, `test/`).

```
modules/
  health/
  lookup/                      providers/brasil-api, open-cnpj, via-cep
  auth/                        session, two-factor, onboarding, password-reset, email-verification
  org/                         tenant, filial, member
  catalog/                     product, product-import
  tax/                         tax-rule, tax-calculation
  fiscal-settings/             emitter-settings, marketplace-billing-settings
  marketplace/                 catálogo e resolução de perfil + configuração efetiva (novo)
  logistics/                   logistics-unit, product-movement
  remessas/                    physical-shipment, symbolic-shipment, branch-transfer, stock-fifo
  fiscal-validation/
  fiscal-documents/            nfe, cte, lifecycle (cancelamento, inutilização, eventos), xml-download, timeline
  sales/                       order, checkout, invoicing
```

- Regra fiscal pura (cálculo de imposto, CFOP, numeração) vai para `packages/fiscal-core`. Regra pura que só faz sentido no app fica em `<feature>/rules/`.
- Mudanças a registrar no `ARCHITECTURE.md` antes da fase 1: os dois níveis de pasta, `rules/` e `packages/fiscal-core/src/marketplaces/`.

### 5. Validação sem quebrar o frontend

O frontend lê `{ error, details }` no formato do Zod. Decidido em 2026-10-22: os DTOs continuam em Zod (um schema por arquivo em `dtos/`), em vez de `class-validator`, para as mensagens ficarem idênticas.

## Fases

Cada fase fecha com: suíte completa, contrato HTTP, golden XMLs, `tsc` de `src` e dos testes, lint, `pnpm depcheck`, build e boot do servidor compilado. Um commit por item numerado.

### Fase 0 — fundação (sem mudança de comportamento)

1. ~~SWC no dev e nos testes~~ — descartado: injeção por `@Inject` explícito e `ClassValidatorPipe(Dto)` dispensam `emitDecoratorMetadata`, e dev, testes e build ficam com o mesmo comportamento.
2. Vitest + `unplugin-swc`, rodando junto com o `node:test` no `run-tests.sh` e no CI.
3. ~~`class-validator`~~ — decidido em 2026-10-22 manter Zod nos DTOs (`dtos/<x>.request.dto.ts` com schema + tipo); `@nestjs/swagger` entrou.
4. `BaseService`, `BaseRepository` (sobre `getDbClient()`), `BusinessException`, `SuccessResponse`, `ResponseWithPagination` em `src/nest/`.
5. `ConfigService` em `src/config/`, substituindo leituras de `process.env`.
6. Golden XMLs: um por tipo de nota do ML, com entradas fixas.

### Fase 1 — marketplace no `fiscal-core` e no `nfe-xml` (sem mudança de comportamento)

7. `marketplaces/` com o perfil do Mercado Livre extraído das constantes atuais; Shopee, Amazon e Magalu como `PENDENTE_CONFIGURACAO`.
8. `enrichFiscalPayloadForMarketplace` e builders do `nfe-xml` lendo `ctx.marketplace`. Golden XMLs idênticos.

### Fase 2 — dados

9. Migration: enum `marketplace`, colunas em `pedidos` e `nfes` com backfill `MERCADO_LIVRE`, renomeações, `unidades_logisticas`, `marketplace_billing_settings` com RLS, conversão de `EMISSOR_ML`.
10. Teste de integração com Postgres descartável: migration aplicada sobre um banco com dados atuais e isolamento entre tenants na tabela nova.

### Fase 3 — módulos pequenos (refatoração pura)

11. `health` · 12. `lookup` · 13. `auth` · 14. `org` · 15. `catalog` · 16. `tax`

O contrato HTTP não muda nesta fase. Testes do módulo migram para Vitest junto com ele.

### Fase 4 — módulos com marketplace

17. `fiscal-settings` + `marketplace-billing-settings` + módulo `marketplace` (`GET /api/marketplaces`, configuração efetiva).
18. `logistics`: unidade por marketplace; a importação de planilha do ML fica em `logistics-unit/adapters/mercado-livre/`.
19. `remessas`: perfil e configuração efetiva na emissão; FIFO por marketplace.
20. `fiscal-validation`.
21. `fiscal-documents`: `marketplace` na nota, filtros e timeline.
22. `sales`: marketplace no pedido, validação do id pelo perfil, bloqueio de faturamento sem configuração.

As mudanças de contrato desta fase são intencionais e vão listadas no commit e no caso de teste que muda.

### Fase 5 — frontend

23. Seletor de marketplace na criação do pedido; marketplace na listagem de pedidos e notas.
24. Configurações fiscais: aba "Padrão" + uma aba por marketplace, mostrando o que é herdado e o que foi sobrescrito.
25. Unidades logísticas filtradas por marketplace.

### Fase 6 — limpeza

26. Remover `node:test`, `presentation/schemas`, `create<Ctx>Module()` e os tokens que sobrarem; atualizar `ARCHITECTURE.md` (seção 12) e `backend/README.md`.

## Riscos

| Risco | Como tratar |
|---|---|
| Regressão no XML do ML | Golden XMLs byte a byte antes da fase 1 |
| Renomear colunas em produção (Neon) | Migration única aplicada no deploy; a versão antiga da API para de funcionar no mesmo instante. Alternativa: expandir/contrair em dois deploys (pede sua escolha antes da fase 2) |
| `details` de validação mudar de formato | `ClassValidatorPipe` devolve o formato do Zod; contrato cobre |
| Tabela nova sem RLS | Teste de integração de isolamento na fase 2 |
| Estoque de um marketplace consumido por outro | FIFO por marketplace + teste dedicado |
| Tamanho da mudança | Um commit por módulo, contrato e suíte verdes em cada um; nada é publicado sem você pedir |

## O que preciso de você (antes de ativar Shopee, Amazon e Magalu)

Para cada marketplace, a partir de XMLs reais ou da documentação dele:

- CNPJ do intermediador e `idCadIntTran` (cadastro do vendedor no intermediador).
- Formato do id do pedido e se usa `xPed` por item.
- Texto de `infCpl` e `obsCont` exigidos.
- CPFs/CNPJs de `autXML` e bloco `infRespTec`, se houver.
- CDs de fulfillment: razão social, CNPJ, IE e endereço.
- Modalidades de frete e o `modFrete` de cada uma.
- CFOP e natureza de operação específicos (remessa para armazém, retorno simbólico, devolução).

Com isso, ativar um marketplace é preencher a pasta dele em `packages/fiscal-core/src/marketplaces/<marketplace>/`, trocar o status para `ATIVO` e adicionar os golden XMLs dele.

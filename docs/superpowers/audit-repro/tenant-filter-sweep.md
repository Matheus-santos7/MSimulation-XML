# Varredura de filtro por tenant

Chamadas examinadas: 225. Sem `tenantId` no `where`: 105. Tabelas com RLS (banco migrado): 15.

## SEM RLS (57)

| Arquivo:linha | Modelo.op | Tabela | where |
|---|---|---|---|
| `backend/src/lib/auth/access-control.ts:46` | `user.findUnique` | `users` | `{ id: payload.userId }` |
| `backend/src/modules/auth/email-verification/email-verification.repository.ts:24` | `emailVerificationToken.updateMany` | `email_verification_tokens` | `{ userId, usedAt: null }` |
| `backend/src/modules/auth/email-verification/email-verification.repository.ts:35` | `emailVerificationToken.findUnique` | `email_verification_tokens` | `{ tokenHash }` |
| `backend/src/modules/auth/email-verification/email-verification.repository.ts:49` | `emailVerificationToken.update` | `email_verification_tokens` | `{ id: tokenId }` |
| `backend/src/modules/auth/email-verification/email-verification.repository.ts:53` | `emailVerificationToken.updateMany` | `email_verification_tokens` | `{ userId, usedAt: null }` |
| `backend/src/modules/auth/email-verification/email-verification.repository.ts:57` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/onboarding/onboarding.repository.ts:24` | `user.findUnique` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/onboarding/onboarding.repository.ts:37` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/password-reset/password-reset.repository.ts:31` | `passwordResetToken.updateMany` | `password_reset_tokens` | `{ userId, usedAt: null }` |
| `backend/src/modules/auth/password-reset/password-reset.repository.ts:42` | `passwordResetToken.findUnique` | `password_reset_tokens` | `{ tokenHash }` |
| `backend/src/modules/auth/password-reset/password-reset.repository.ts:64` | `passwordResetToken.update` | `password_reset_tokens` | `{ id: tokenId }` |
| `backend/src/modules/auth/password-reset/password-reset.repository.ts:68` | `passwordResetToken.updateMany` | `password_reset_tokens` | `{ userId, usedAt: null }` |
| `backend/src/modules/auth/password-reset/password-reset.repository.ts:72` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/session/user-session.repository.ts:46` | `userSession.findUnique` | `user_sessions` | `{ refreshTokenHash }` |
| `backend/src/modules/auth/session/user-session.repository.ts:56` | `userSession.updateMany` | `user_sessions` | `{ refreshTokenHash, revokedAt: null }` |
| `backend/src/modules/auth/session/user-session.repository.ts:64` | `userSession.update` | `user_sessions` | `{ id: sessionId }` |
| `backend/src/modules/auth/session/user-session.repository.ts:72` | `userSession.updateMany` | `user_sessions` | `{ userId, revokedAt: null }` |
| `backend/src/modules/auth/user/user.repository.ts:27` | `user.findUnique` | `users` | `{ email }` |
| `backend/src/modules/auth/user/user.repository.ts:36` | `user.findUnique` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:45` | `user.findUnique` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:51` | `user.findUnique` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:59` | `user.findUnique` | `users` | `{ email }` |
| `backend/src/modules/auth/user/user.repository.ts:86` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:94` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:105` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:113` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:124` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:132` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/auth/user/user.repository.ts:140` | `user.update` | `users` | `{ id: userId }` |
| `backend/src/modules/catalog/product/product.repository.ts:115` | `pedidoItem.findMany` | `pedido_itens` | `{ productId, pedido: { status: "RASCUNHO" } }` |
| `backend/src/modules/fiscal-documents/document-return/rules/return-fiscal.rules.ts:129` | `unidadeLogistica.findUnique` | `unidades_logisticas` | `{ marketplace_cnpj: { marketplace: remessa.marketplace, cnpj } }` |
| `backend/src/modules/fiscal-documents/nfe/nfe.repository.ts:74` | `nfeRemessaConsumo.findMany` | `nfe_remessa_consumos` | `{ retornoNfeId: row.id }` |
| `backend/src/modules/logistics/logistics-unit/active-logistics-unit.queries.ts:9` | `unidadeLogistica.findFirst` | `unidades_logisticas` | `{ id: unitId, ativa: true }` |
| `backend/src/modules/logistics/logistics-unit/active-logistics-unit.queries.ts:21` | `unidadeLogistica.findFirst` | `unidades_logisticas` | `{ codigo: norm, ativa: true }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:60` | `unidadeLogistica.findMany` | `unidades_logisticas` | `{ ...(filter?.ativa !== undefined ? { ativa: filter.ativa } : {}), ...` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:82` | `unidadeLogistica.findUnique` | `unidades_logisticas` | `{ id }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:92` | `unidadeLogistica.findFirst` | `unidades_logisticas` | `{ id: unitId, ativa: true }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:102` | `unidadeLogistica.findFirst` | `unidades_logisticas` | `{ codigo: norm, ativa: true }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:117` | `unidadeLogistica.findUniqueOrThrow` | `unidades_logisticas` | `{ id: unit.id }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:154` | `unidadeLogistica.findFirst` | `unidades_logisticas` | `{ id: unitId, ativa: true }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:236` | `unidadeLogistica.findUnique` | `unidades_logisticas` | `{ marketplace_cnpj: { marketplace, cnpj } }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:241` | `unidadeLogistica.findUnique` | `unidades_logisticas` | `{ marketplace_codigo: { marketplace, codigo } }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:272` | `unidadeLogistica.update` | `unidades_logisticas` | `{ id: existing.id }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:293` | `unidadeLogistica.findUnique` | `unidades_logisticas` | `{ marketplace_codigo: { marketplace, codigo } }` |
| `backend/src/modules/org/member/member.repository.ts:49` | `user.findUnique` | `users` | `{ id }` |
| `backend/src/modules/org/member/member.repository.ts:54` | `user.update` | `users` | `{ id }` |
| `backend/src/modules/org/member/member.repository.ts:65` | `userSession.updateMany` | `user_sessions` | `{ userId: id, revokedAt: null }` |
| `backend/src/modules/org/member/member.repository.ts:86` | `user.delete` | `users` | `{ id }` |
| `backend/src/modules/org/tenant/tenant.repository.ts:22` | `tenant.findUnique` | `tenants` | `{ id }` |
| `backend/src/modules/org/tenant/tenant.repository.ts:27` | `tenant.findUnique` | `tenants` | `{ id }` |
| `backend/src/modules/org/tenant/tenant.repository.ts:40` | `tenant.findUnique` | `tenants` | `{ id }` |
| `backend/src/modules/org/tenant/tenant.repository.ts:44` | `tenant.update` | `tenants` | `{ id }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-balance-query.ts:135` | `unidadeLogistica.findMany` | `unidades_logisticas` | `{ codigo: { in: codigos }, ativa: true }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts:311` | `nfeRemessaConsumo.findMany` | `nfe_remessa_consumos` | `{ retornoNfeId }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts:362` | `nfeRemessaConsumo.findMany` | `nfe_remessa_consumos` | `{ retornoNfeId }` |
| `backend/src/modules/sales/invoicing/sales-chain/return-note.emitter.ts:265` | `nfeRemessaConsumo.findMany` | `nfe_remessa_consumos` | `{ retornoNfeId: returnNote.id }` |
| `backend/src/modules/sales/order/order.repository.ts:108` | `pedidoItem.deleteMany` | `pedido_itens` | `{ pedidoId: id }` |

## RLS (48)

| Arquivo:linha | Modelo.op | Tabela | where |
|---|---|---|---|
| `backend/src/modules/catalog/product/product.repository.ts:77` | `product.update` | `products` | `{ id }` |
| `backend/src/modules/catalog/product/product.repository.ts:121` | `pedido.deleteMany` | `pedidos` | `{ id: { in: draftPedidoIds } }` |
| `backend/src/modules/catalog/product/product.repository.ts:123` | `product.delete` | `products` | `{ id: productId }` |
| `backend/src/modules/fiscal-documents/cancellation/use-cases/cancellation.usecase.ts:57` | `nFe.findFirst` | `nfes` | `{ tipo: NFeTipo.DEVOLUCAO, nfeReferenciaId: sale.id, ...fiscalNotDelet` |
| `backend/src/modules/fiscal-documents/cancellation/use-cases/cancellation.usecase.ts:111` | `cTe.update` | `ctes` | `{ id: sale.cteVenda.id }` |
| `backend/src/modules/fiscal-documents/cancellation/use-cases/cancellation.usecase.ts:117` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: sale.id }` |
| `backend/src/modules/fiscal-documents/cancellation/use-cases/cancellation.usecase.ts:122` | `nFe.findUnique` | `nfes` | `{ id: symbolicReturn.id }` |
| `backend/src/modules/fiscal-documents/cancellation/use-cases/cancellation.usecase.ts:148` | `fiscalEvent.findFirst` | `fiscal_events` | `{ nfeId: params.nfeId, tipo: CANCELLATION_EVENT_TYPE }` |
| `backend/src/modules/fiscal-documents/cancellation/use-cases/cancellation.usecase.ts:167` | `nFe.update` | `nfes` | `{ id: params.nfeId }` |
| `backend/src/modules/fiscal-documents/cte/cte.repository.ts:54` | `cTe.update` | `ctes` | `{ chave: accessKey }` |
| `backend/src/modules/fiscal-documents/cte/xml/cte-xml.service.ts:70` | `cTe.update` | `ctes` | `{ id: cteId }` |
| `backend/src/modules/fiscal-documents/cte/xml/cte-xml.service.ts:130` | `cTe.update` | `ctes` | `{ id: row.id }` |
| `backend/src/modules/fiscal-documents/cte/xml/cte-xml.service.ts:201` | `cTe.update` | `ctes` | `{ id: row.id }` |
| `backend/src/modules/fiscal-documents/document-return/use-cases/physical-return.usecase.ts:69` | `nFe.findFirst` | `nfes` | `{ tipo: NFeTipo.RETORNO_FISICO, nfeReferenciaId: remessa.id, deletedAt` |
| `backend/src/modules/fiscal-documents/document-return/use-cases/physical-return.usecase.ts:251` | `nFe.update` | `nfes` | `{ id: remessa.id }` |
| `backend/src/modules/fiscal-documents/document-return/use-cases/sale-return.usecase.ts:378` | `nFe.findUnique` | `nfes` | `{ id: sale.nfeReferencia.nfeReferenciaId }` |
| `backend/src/modules/fiscal-documents/document-return/use-cases/sale-return.usecase.ts:581` | `nFe.findMany` | `nfes` | `{ tipo: { in: [...RETURN_TIPOS] }, nfeReferenciaId: saleId, deletedAt:` |
| `backend/src/modules/fiscal-documents/inbound-conference/use-cases/inbound-conference.usecase.ts:196` | `nFe.update` | `nfes` | `{ id: remessa.id }` |
| `backend/src/modules/fiscal-documents/nfe/nfe.repository.ts:129` | `nFe.update` | `nfes` | `{ chave: accessKey }` |
| `backend/src/modules/fiscal-documents/nfe/xml/nfe-xml.service.ts:100` | `nFe.update` | `nfes` | `{ id: args.nfeId }` |
| `backend/src/modules/fiscal-documents/nfe/xml/nfe-xml.service.ts:124` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: args.nfeId }` |
| `backend/src/modules/fiscal-documents/nfe/xml/nfe-xml.service.ts:131` | `nfeItem.findMany` | `nfe_itens` | `{ nfeId: args.nfeId }` |
| `backend/src/modules/fiscal-validation/nfe-validation/use-cases/nfe-validation-backfill.usecase.ts:83` | `nFe.update` | `nfes` | `{ id: row.id }` |
| `backend/src/modules/logistics/logistics-unit/logistics-unit.repository.ts:171` | `tenantUnidadeLogistica.update` | `tenant_unidades_logisticas` | `{ id: link.id }` |
| `backend/src/modules/org/emitente-fiscal/fiscal-roles.rules.ts:39` | `tenantFilial.update` | `tenant_filiais` | `{ id: remessaId }` |
| `backend/src/modules/org/emitente-fiscal/fiscal-roles.rules.ts:46` | `tenantFilial.update` | `tenant_filiais` | `{ id: transferenciaId }` |
| `backend/src/modules/org/filial/filial.repository.ts:53` | `tenantFilial.update` | `tenant_filiais` | `{ id }` |
| `backend/src/modules/org/filial/filial.repository.ts:84` | `tenantFilial.delete` | `tenant_filiais` | `{ id }` |
| `backend/src/modules/remessas/fiscal-chain/fiscal-chain-note.repository.ts:61` | `nFe.findFirst` | `nfes` | `{ id: remessaNfeId, tipo: { in: [NFeTipo.REMESSA, NFeTipo.REMESSA_AVAN` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-balance-query.ts:29` | `nfeItem.findMany` | `nfe_itens` | `(sem where)` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-balance-query.ts:61` | `nfeItem.findMany` | `nfe_itens` | `{ nfeId: { in: remessaIds } }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-balance-query.ts:87` | `nfeItem.findMany` | `nfe_itens` | `{ nfeId }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-balance-query.ts:107` | `nfeItem.findMany` | `nfe_itens` | `(sem where)` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts:69` | `nfeItem.findMany` | `nfe_itens` | `(sem where)` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts:108` | `nfeItem.update` | `nfe_itens` | `{ id: item.id }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts:190` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: remessaNfeId }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts:207` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: remessaNfeId }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts:343` | `nfeItem.update` | `nfe_itens` | `{ id: consumo.nfeItemId }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts:367` | `nfeItem.update` | `nfe_itens` | `{ id: consumo.nfeItemId }` |
| `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-item-sync.ts:116` | `nfeItem.update` | `nfe_itens` | `{ id: item.id }` |
| `backend/src/modules/remessas/warehouse-advance/use-cases/warehouse-advance-emit.usecase.ts:142` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: remessaSimbPersistida.id }` |
| `backend/src/modules/remessas/warehouse-advance/warehouse-advance-fiscal.emitter.ts:252` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: retornoReferencia.id }` |
| `backend/src/modules/remessas/warehouse-advance/warehouse-advance.mapper.ts:7` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: result.remessaSimbolica.id }` |
| `backend/src/modules/remessas/warehouse-advance/warehouse-advance.mapper.ts:12` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: result.retornoSimbolico.id }` |
| `backend/src/modules/sales/invoicing/sales-chain/sales-chain.emitter.ts:107` | `nFe.findUniqueOrThrow` | `nfes` | `{ id: returnNote.id }` |
| `backend/src/modules/sales/order/order.repository.ts:110` | `pedido.update` | `pedidos` | `{ id }` |
| `backend/src/modules/sales/order/order.repository.ts:128` | `pedido.update` | `pedidos` | `{ id }` |
| `backend/src/modules/sales/order/order.repository.ts:142` | `pedido.delete` | `pedidos` | `{ id }` |


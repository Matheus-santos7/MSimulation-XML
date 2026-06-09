/**
 * Rotas HTTP `/api/*` de documentos fiscais, timeline e regras tributárias.
 *
 * ## Responsabilidade desta camada
 *
 * - Validar query/params/body (Zod).
 * - `tenantId` exclusivamente do JWT (`request.user.tenantId`).
 * - Delegar regras de negócio aos *services* (`*-service.ts`).
 * - Mapear entidades Prisma → DTO (`fiscal-mappers`, `tenant-mapper`).
 *
 * Emissões (remessa, venda, devolução) ficam em `pedidos`, `products` e services;
 * aqui há leitura, soft delete, cancelamento, inutilização e import de planilha.
 *
 * ## Mapa de rotas (prefixo `/api`)
 *
 * | Método | Caminho | Service / origem |
 * |--------|---------|------------------|
 * | GET | `/nfes` | Prisma + `mapNfe` |
 * | GET | `/nfes/:chave` | Prisma (detalhe + referenciadas + CT-e) |
 * | GET | `/nfes/:chave/xml` | `resolveNfeXml` — XML persistido ou regerado |
 * | DELETE | `/nfes/:chave` | `FiscalService.softDeleteNfe` |
 * | POST | `/nfes/:chave/devolucao` | `emitirDevolucaoVenda` |
 * | POST | `/nfes/:chave/cancelamento` | `cancelarVenda` |
 * | POST | `/nfes/inutilizar` | `inutilizarNumeracao` — registrar **antes** de rotas com `:chave` |
 * | GET | `/emitente` | Tenant |
 * | GET/DELETE | `/ctes`, `/ctes/:chave` | Prisma / `FiscalService` |
 * | GET | `/fiscal-events` | Eventos 110111 + inutilizações (`INUT`) |
 * | GET | `/audit-logs` | Auditoria |
 * | GET | `/timeline` | `listTimelineChains` |
 * | GET | `/timeline/steps` | Seed legado |
 * | GET | `/tax-rules`, `/tax-rules/catalog` | Planilha / catálogo |
 * | POST | `/tax-rules/bulk-upsert` | Importação em lote |
 */
import type { FastifyPluginAsync } from "fastify";
import { FiscalService } from "../../services/fiscal-service.js";
import { registerCteAndEmitenteRoutes } from "./ctes.routes.js";
import { registerNfeRoutes } from "./nfes.routes.js";
import { registerObservabilityRoutes } from "./observability.routes.js";
import { registerTaxRuleRoutes } from "./tax-rules.routes.js";

export const fiscalRoutes: FastifyPluginAsync = async (app) => {
  const fiscal = new FiscalService(app.prisma);

  registerNfeRoutes(app, fiscal);
  registerCteAndEmitenteRoutes(app, fiscal);
  registerObservabilityRoutes(app);
  registerTaxRuleRoutes(app);
};

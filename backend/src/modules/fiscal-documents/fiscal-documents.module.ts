import { Module } from "@nestjs/common";
import { CancellationController } from "./cancellation/cancellation.controller.js";
import { CancellationUseCase } from "./cancellation/use-cases/cancellation.usecase.js";
import { CteController } from "./cte/cte.controller.js";
import { CteRepository } from "./cte/cte.repository.js";
import { CteService } from "./cte/cte.service.js";
import { DocumentReturnController } from "./document-return/document-return.controller.js";
import { PhysicalReturnUseCase } from "./document-return/use-cases/physical-return.usecase.js";
import { SaleReturnUseCase } from "./document-return/use-cases/sale-return.usecase.js";
import { InboundConferenceController } from "./inbound-conference/inbound-conference.controller.js";
import { InboundConferenceUseCase } from "./inbound-conference/use-cases/inbound-conference.usecase.js";
import { NfeController } from "./nfe/nfe.controller.js";
import { NfeRepository } from "./nfe/nfe.repository.js";
import { NfeService } from "./nfe/nfe.service.js";
import { NumberInutilizationController } from "./number-inutilization/number-inutilization.controller.js";
import { NumberInutilizationUseCase } from "./number-inutilization/use-cases/number-inutilization.usecase.js";
import { ObservabilityController } from "./observability/observability.controller.js";

/**
 * Documentos fiscais: consulta de NF-e e CT-e, ciclo de vida da NF-e e observabilidade.
 *
 * | Pasta | Rotas |
 * |-------|-------|
 * | `nfe/` | GET /nfes (`?marketplace=`), /nfes/:chave, /nfes/:chave/xml, DELETE /nfes/:chave |
 * | `cte/` | GET /emitente, /ctes, /ctes/:chave, /ctes/:chave/xml, DELETE /ctes/:chave |
 * | `cancellation/` | POST /nfes/:chave/cancelamento |
 * | `document-return/` | GET/POST /nfes/:chave/devolucao, /insulcesso, /retorno-fisico |
 * | `inbound-conference/` | GET/POST /nfes/:chave/conferencia |
 * | `number-inutilization/` | POST /nfes/inutilizar |
 * | `observability/` | /fiscal-events, /audit-logs, /timeline (`?marketplace=`) |
 *
 * `nfe/xml` e `cte/xml` geram e guardam o XML; `shared/` tem o mapper de resposta e os DTOs
 * comuns. As rotas do ciclo de vida são ADMIN.
 */
@Module({
  controllers: [
    NumberInutilizationController,
    DocumentReturnController,
    InboundConferenceController,
    CancellationController,
    NfeController,
    CteController,
    ObservabilityController,
  ],
  providers: [
    NfeRepository,
    NfeService,
    CteRepository,
    CteService,
    CancellationUseCase,
    SaleReturnUseCase,
    PhysicalReturnUseCase,
    InboundConferenceUseCase,
    NumberInutilizationUseCase,
  ],
})
export class FiscalDocumentsModule {}

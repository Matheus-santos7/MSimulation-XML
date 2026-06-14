import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { CancelDocumentUseCase } from "../../application/use-cases/cancel-document.use-case.js";
import { GetCteByKeyUseCase } from "../../application/use-cases/get-cte-by-key.use-case.js";
import { GetCteXmlUseCase } from "../../application/use-cases/get-cte-xml.use-case.js";
import { GetNfeByKeyUseCase } from "../../application/use-cases/get-nfe-by-key.use-case.js";
import { GetNfeXmlUseCase } from "../../application/use-cases/get-nfe-xml.use-case.js";
import { InutilizeNumberUseCase } from "../../application/use-cases/inutilize-number.use-case.js";
import { ListCtesUseCase } from "../../application/use-cases/list-ctes.use-case.js";
import { ListNfesUseCase } from "../../application/use-cases/list-nfes.use-case.js";
import { ProcessReturnUseCase } from "../../application/use-cases/process-return.use-case.js";
import { SoftDeleteCteUseCase } from "../../application/use-cases/soft-delete-cte.use-case.js";
import { SoftDeleteNfeUseCase } from "../../application/use-cases/soft-delete-nfe.use-case.js";
import { PrismaCteQueryRepository } from "../prisma/prisma-cte-query.repository.js";
import { PrismaDocumentCancellationRepository } from "../prisma/prisma-document-cancellation.repository.js";
import { PrismaDocumentReturnRepository } from "../prisma/prisma-document-return.repository.js";
import { PrismaFiscalDocumentSoftDeleteRepository } from "../prisma/prisma-fiscal-document-soft-delete.repository.js";
import { PrismaNfeQueryRepository } from "../prisma/prisma-nfe-query.repository.js";
import { PrismaNumberInutilizationRepository } from "../prisma/prisma-number-inutilization.repository.js";

/** Composition root for the Fiscal Documents bounded context. */
export function createFiscalDocumentsModule(db: DbClient) {
  const cancellationRepository = new PrismaDocumentCancellationRepository(db);
  const returnRepository = new PrismaDocumentReturnRepository(db);
  const inutilizationRepository = new PrismaNumberInutilizationRepository(db);
  const nfeQueryRepository = new PrismaNfeQueryRepository(db);
  const cteQueryRepository = new PrismaCteQueryRepository(db);
  const softDeleteRepository = new PrismaFiscalDocumentSoftDeleteRepository(db);

  return {
    cancelDocument: new CancelDocumentUseCase(cancellationRepository),
    processReturn: new ProcessReturnUseCase(returnRepository),
    inutilizeNumber: new InutilizeNumberUseCase(inutilizationRepository),
    listNfes: new ListNfesUseCase(nfeQueryRepository),
    getNfeByKey: new GetNfeByKeyUseCase(nfeQueryRepository),
    getNfeXml: new GetNfeXmlUseCase(nfeQueryRepository),
    softDeleteNfe: new SoftDeleteNfeUseCase(softDeleteRepository),
    listCtes: new ListCtesUseCase(cteQueryRepository),
    getCteByKey: new GetCteByKeyUseCase(cteQueryRepository),
    getCteXml: new GetCteXmlUseCase(cteQueryRepository),
    softDeleteCte: new SoftDeleteCteUseCase(softDeleteRepository),
    cancellationRepository,
    returnRepository,
    inutilizationRepository,
    nfeQueryRepository,
    cteQueryRepository,
    softDeleteRepository,
  };
}

import { RouteErrorFilter } from "../../../nest/http/api-exception.filter.js";
import { FISCAL_DOCUMENT_STATUS_ERRORS } from "../errors/fiscal-documents.errors.js";

/** Filtro das rotas de ciclo de vida da NF-e: os erros de domínio respondem com o próprio `status`. */
export const lifecycleErrorFilter = new RouteErrorFilter({
  statusErrors: FISCAL_DOCUMENT_STATUS_ERRORS,
});

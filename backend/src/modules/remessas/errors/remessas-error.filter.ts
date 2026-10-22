import { Catch } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import { resolveRouteError, type RouteErrorMapping } from "../../../lib/http/domain-errors.js";
import type { ErrorResponse } from "../../../lib/http/http-error.js";
import { ApiExceptionFilter } from "../../../nest/http/api-exception.filter.js";
import { LogisticsUnitError } from "../../logistics/index.js";
import { EmitenteFiscalConfigError } from "../../org/index.js";
import { BranchTransferError } from "../branch-transfer/branch-transfer.errors.js";
import { ShipmentError } from "../shipment/shipment.errors.js";
import { SaldoRemessaInsuficienteError } from "../stock-fifo/queries/remessa-fifo.errors.js";
import { SymbolicShipmentFiscalError } from "../symbolic-shipment/symbolic-shipment.errors.js";
import { RemessaDomainError } from "./remessas.errors.js";

const HTTP_BAD_REQUEST = 400;
const HTTP_SERVICE_UNAVAILABLE = 503;
const PRISMA_TRANSACTION_TIMEOUT = "P2028";
const TRANSACTION_TIMEOUT_MESSAGE =
  "A emissão demorou mais que o esperado. Tente novamente; se persistir, reduza a quantidade ou contate o suporte.";

const BAD_REQUEST_ERRORS = [
  RemessaDomainError,
  SaldoRemessaInsuficienteError,
  ShipmentError,
  SymbolicShipmentFiscalError,
  BranchTransferError,
  EmitenteFiscalConfigError,
  LogisticsUnitError,
] as const;

const REMESSAS_ERROR_MAPPINGS: readonly RouteErrorMapping[] = BAD_REQUEST_ERRORS.map((type) => ({
  type,
  status: HTTP_BAD_REQUEST,
}));

function isTransactionTimeout(exception: unknown): boolean {
  return (
    typeof exception === "object" &&
    exception !== null &&
    "code" in exception &&
    exception.code === PRISMA_TRANSACTION_TIMEOUT
  );
}

/**
 * Filtro das rotas de emissão (`/movimentacoes/*`): erro de emissão vira 400 e o timeout da
 * transação interativa vira 503 com orientação. O resto (incluindo o 422 de marketplace sem
 * configuração) segue o contrato global.
 */
@Catch()
export class RemessasErrorFilter extends ApiExceptionFilter {
  protected override resolve(exception: unknown, log: FastifyBaseLogger): ErrorResponse {
    if (isTransactionTimeout(exception)) {
      return { status: HTTP_SERVICE_UNAVAILABLE, body: { error: TRANSACTION_TIMEOUT_MESSAGE } };
    }

    return (
      resolveRouteError(exception, { mappings: REMESSAS_ERROR_MAPPINGS }) ??
      super.resolve(exception, log)
    );
  }
}

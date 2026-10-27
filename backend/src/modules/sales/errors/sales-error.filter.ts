import { RouteErrorFilter } from "../../../nest/http/api-exception.filter.js";
import { SaldoRemessaInsuficienteError } from "../../remessas/index.js";
import { CheckoutError, OrderLockedError, SalesChainError } from "./sales.errors.js";

const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE_ENTITY = 422;

/**
 * Erros das rotas de pedido. Saldo de remessa insuficiente responde 422 com `disponivel` e
 * `solicitado`; marketplace sem perfil fiscal cai no 422 do filtro global.
 */
export const salesErrorFilter = new RouteErrorFilter({
  mappings: [
    { type: OrderLockedError, status: HTTP_CONFLICT },
    { type: CheckoutError, status: HTTP_BAD_REQUEST },
    { type: SalesChainError, status: HTTP_BAD_REQUEST },
    {
      type: SaldoRemessaInsuficienteError,
      status: HTTP_UNPROCESSABLE_ENTITY,
      toBody: (error: Error) => {
        const e = error as SaldoRemessaInsuficienteError;

        return { error: e.message, disponivel: e.disponivel, solicitado: e.solicitado };
      },
    },
  ],
});

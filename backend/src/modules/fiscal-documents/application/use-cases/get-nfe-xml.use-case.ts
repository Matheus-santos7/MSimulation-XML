import type { NfeQueryPort } from "../../domain/ports/nfe-query.port.js";

export type GetNfeXmlOptions = {
  /** XML do evento de cancelamento (procEventoNFe, tpEvento 110111). */
  doc?: "evento";
};

export class GetNfeXmlUseCase {
  constructor(private readonly nfeQuery: NfeQueryPort) {}

  execute(tenantId: string, accessKey: string, options?: GetNfeXmlOptions) {
    if (options?.doc === "evento") {
      return this.nfeQuery.resolveCancelamentoEventoXml(tenantId, accessKey);
    }
    return this.nfeQuery.resolveXml(tenantId, accessKey);
  }

  getTipoWhenMissing(tenantId: string, accessKey: string) {
    return this.nfeQuery.getTipoWhenXmlMissing(tenantId, accessKey);
  }
}

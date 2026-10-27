import { Inject, Injectable } from "@nestjs/common";
import { NfeRepository } from "./nfe.repository.js";
import type { ListNfesFilter, NfeDetail, NfeListItem, NfeXmlResult } from "./nfe.types.js";

export type NfeXmlDocument = "evento";

/** Consulta de NF-e: listagem, detalhe, XML (nota ou evento de cancelamento) e exclusão lógica. */
@Injectable()
export class NfeService {
  constructor(@Inject(NfeRepository) private readonly repository: NfeRepository) {}

  list(tenantId: string, filter: ListNfesFilter = {}): Promise<NfeListItem[]> {
    return this.repository.list(tenantId, filter);
  }

  get(tenantId: string, accessKey: string): Promise<NfeDetail | null> {
    return this.repository.getByAccessKey(tenantId, accessKey);
  }

  /** `doc: "evento"` devolve o procEventoNFe do cancelamento (tpEvento 110111). */
  xml(tenantId: string, accessKey: string, doc?: NfeXmlDocument): Promise<NfeXmlResult | null> {
    return doc === "evento"
      ? this.repository.resolveCancelamentoEventoXml(tenantId, accessKey)
      : this.repository.resolveXml(tenantId, accessKey);
  }

  /** Tipo da NF-e sem XML (para o 409); `null` quando a NF-e não existe. */
  tipoWhenXmlMissing(tenantId: string, accessKey: string): Promise<string | null> {
    return this.repository.getTipoWhenXmlMissing(tenantId, accessKey);
  }

  softDelete(accessKey: string, tenantId: string): Promise<boolean> {
    return this.repository.softDelete(accessKey, tenantId);
  }
}

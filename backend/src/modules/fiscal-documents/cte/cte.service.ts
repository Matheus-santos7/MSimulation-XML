import { Inject, Injectable } from "@nestjs/common";
import { CteRepository } from "./cte.repository.js";
import type { CteListItem, CteXmlResult } from "./cte.types.js";

/** Consulta de CT-e: listagem, detalhe, XML e exclusão lógica. */
@Injectable()
export class CteService {
  constructor(@Inject(CteRepository) private readonly repository: CteRepository) {}

  list(tenantId: string): Promise<CteListItem[]> {
    return this.repository.list(tenantId);
  }

  get(tenantId: string, accessKey: string): Promise<CteListItem | null> {
    return this.repository.getByAccessKey(tenantId, accessKey);
  }

  xml(tenantId: string, accessKey: string): Promise<CteXmlResult | null> {
    return this.repository.resolveXml(tenantId, accessKey);
  }

  exists(tenantId: string, accessKey: string): Promise<boolean> {
    return this.repository.exists(tenantId, accessKey);
  }

  softDelete(accessKey: string, tenantId: string): Promise<boolean> {
    return this.repository.softDelete(accessKey, tenantId);
  }
}

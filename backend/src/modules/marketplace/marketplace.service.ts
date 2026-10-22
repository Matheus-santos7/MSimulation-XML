import { Injectable } from "@nestjs/common";
import { listMarketplaceProfiles } from "@msimulation-xml/fiscal-core";
import type { MarketplaceSummary } from "./marketplace.types.js";

/** Catálogo de marketplaces a partir dos perfis fiscais (`fiscal-core/src/marketplaces/`). */
@Injectable()
export class MarketplaceService {
  list(): MarketplaceSummary[] {
    return listMarketplaceProfiles().map((profile) => ({
      code: profile.code,
      nome: profile.nome,
      status: profile.status,
      faturamentoDisponivel: profile.status === "ATIVO",
    }));
  }
}

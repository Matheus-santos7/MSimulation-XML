import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProtectedApi } from "../../nest/api-access.decorators.js";
import { MarketplaceService } from "./marketplace.service.js";

/** `GET /marketplaces`: marketplaces atendidos e se já podem faturar. */
@Controller("marketplaces")
@ApiTags("marketplaces")
@ProtectedApi()
export class MarketplaceController {
  constructor(@Inject(MarketplaceService) private readonly marketplaces: MarketplaceService) {}

  @Get()
  list() {
    return this.marketplaces.list();
  }
}

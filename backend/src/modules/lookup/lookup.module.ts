import { Module } from "@nestjs/common";
import { LookupController } from "./lookup.controller.js";
import { LookupService } from "./lookup.service.js";
import { CepLookupProvider } from "./providers/cep-lookup.provider.js";
import { CnpjLookupProvider } from "./providers/cnpj-lookup.provider.js";

@Module({
  controllers: [LookupController],
  providers: [LookupService, CepLookupProvider, CnpjLookupProvider],
  exports: [LookupService, CepLookupProvider],
})
export class LookupModule {}

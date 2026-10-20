import { Module } from "@nestjs/common";
import { createRemessasModule } from "./infrastructure/factory/remessas-module.factory.js";
import { REMESSAS } from "./remessas.tokens.js";

/** Remessas não expõe rotas: fornece os use cases de emissão para os controllers de logística. */
@Module({
  providers: [{ provide: REMESSAS, useFactory: createRemessasModule }],
  exports: [REMESSAS],
})
export class RemessasModule {}

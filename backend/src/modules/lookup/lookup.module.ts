import { Module } from "@nestjs/common";
import { createLookupModule } from "./infrastructure/factory/lookup-module.factory.js";
import { LOOKUP } from "./lookup.tokens.js";
import { LookupController } from "./presentation/controllers/lookup.controller.js";

@Module({
  controllers: [LookupController],
  providers: [{ provide: LOOKUP, useFactory: createLookupModule }],
})
export class LookupModule {}

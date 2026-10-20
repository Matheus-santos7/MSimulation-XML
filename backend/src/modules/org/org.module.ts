import { Module } from "@nestjs/common";
import { createOrgModule } from "./infrastructure/factory/org-module.factory.js";
import { ORG } from "./org.tokens.js";
import { TenantFilialController } from "./presentation/controllers/tenant-filial.controller.js";
import { TenantController } from "./presentation/controllers/tenant.controller.js";
import { UserController } from "./presentation/controllers/user.controller.js";

@Module({
  controllers: [TenantController, TenantFilialController, UserController],
  providers: [{ provide: ORG, useFactory: createOrgModule }],
})
export class OrgModule {}

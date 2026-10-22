import { Module } from "@nestjs/common";
import { FilialController } from "./filial/filial.controller.js";
import { FilialRepository } from "./filial/filial.repository.js";
import { FilialService } from "./filial/filial.service.js";
import { SetFiscalRolesUseCase } from "./filial/use-cases/set-fiscal-roles.usecase.js";
import { MemberController } from "./member/member.controller.js";
import { MemberRepository } from "./member/member.repository.js";
import { MemberService } from "./member/member.service.js";
import { PasswordHasherProvider } from "./providers/password-hasher.provider.js";
import { TenantController } from "./tenant/tenant.controller.js";
import { TenantRepository } from "./tenant/tenant.repository.js";
import { TenantService } from "./tenant/tenant.service.js";

/**
 * Contexto da organização: empresa (tenant), filiais e usuários.
 *
 * | Pasta | Rotas |
 * |-------|-------|
 * | `tenant/` | /tenants |
 * | `filial/` | /empresas/filiais, /empresas/papeis-fiscais, /filiais |
 * | `member/` | /users |
 *
 * `emitente-fiscal/` resolve qual estabelecimento emite cada nota (usado pelo remessas).
 */
@Module({
  controllers: [TenantController, FilialController, MemberController],
  providers: [
    PasswordHasherProvider,
    TenantRepository,
    TenantService,
    FilialRepository,
    FilialService,
    SetFiscalRolesUseCase,
    MemberRepository,
    MemberService,
  ],
})
export class OrgModule {}

import { AddTenantFilialUseCase } from "../../application/use-cases/add-tenant-filial.use-case.js";
import { CreateTenantUseCase } from "../../application/use-cases/create-tenant.use-case.js";
import { CreateUserUseCase } from "../../application/use-cases/create-user.use-case.js";
import { DeleteTenantUseCase } from "../../application/use-cases/delete-tenant.use-case.js";
import { DeleteUserUseCase } from "../../application/use-cases/delete-user.use-case.js";
import { GetTenantByIdUseCase } from "../../application/use-cases/get-tenant-by-id.use-case.js";
import { GetUserByIdUseCase } from "../../application/use-cases/get-user-by-id.use-case.js";
import { ListTenantFiliaisUseCase } from "../../application/use-cases/list-tenant-filiais.use-case.js";
import { ListTenantsUseCase } from "../../application/use-cases/list-tenants.use-case.js";
import { ListUsersByTenantUseCase } from "../../application/use-cases/list-users-by-tenant.use-case.js";
import { RemoveTenantFilialUseCase } from "../../application/use-cases/remove-tenant-filial.use-case.js";
import { SetTenantFiscalRolesUseCase } from "../../application/use-cases/set-tenant-fiscal-roles.use-case.js";
import { UpdateTenantFilialUseCase } from "../../application/use-cases/update-tenant-filial.use-case.js";
import { UpdateTenantUseCase } from "../../application/use-cases/update-tenant.use-case.js";
import { UpdateUserUseCase } from "../../application/use-cases/update-user.use-case.js";
import { PasswordHasherAdapter } from "../external/password-hasher.adapter.js";
import { PrismaOrgUserRepository } from "../prisma/prisma-org-user.repository.js";
import { PrismaTenantFilialRepository } from "../prisma/prisma-tenant-filial.repository.js";
import { PrismaTenantRepository } from "../prisma/prisma-tenant.repository.js";

/** Composition root for the Org module. */
export function createOrgModule() {
  const tenantRepository = new PrismaTenantRepository();
  const tenantFilialRepository = new PrismaTenantFilialRepository();
  const orgUserRepository = new PrismaOrgUserRepository();
  const passwordHasher = new PasswordHasherAdapter();

  return {
    listTenants: new ListTenantsUseCase(tenantRepository),
    getTenantById: new GetTenantByIdUseCase(tenantRepository),
    createTenant: new CreateTenantUseCase(tenantRepository),
    updateTenant: new UpdateTenantUseCase(tenantRepository),
    deleteTenant: new DeleteTenantUseCase(tenantRepository),
    listTenantFiliais: new ListTenantFiliaisUseCase(tenantFilialRepository),
    addTenantFilial: new AddTenantFilialUseCase(tenantFilialRepository),
    updateTenantFilial: new UpdateTenantFilialUseCase(tenantFilialRepository),
    removeTenantFilial: new RemoveTenantFilialUseCase(tenantFilialRepository),
    setTenantFiscalRoles: new SetTenantFiscalRolesUseCase(tenantRepository, tenantFilialRepository),
    listUsersByTenant: new ListUsersByTenantUseCase(orgUserRepository),
    getUserById: new GetUserByIdUseCase(orgUserRepository),
    createUser: new CreateUserUseCase(orgUserRepository, passwordHasher),
    updateUser: new UpdateUserUseCase(orgUserRepository, passwordHasher),
    deleteUser: new DeleteUserUseCase(orgUserRepository),
    tenantRepository,
    tenantFilialRepository,
    orgUserRepository,
  };
}

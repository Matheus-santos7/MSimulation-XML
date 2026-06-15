/**
 * Bounded Context: Organization (tenants and users).
 */
export type { Tenant, EnvironmentKind } from "./domain/entities/tenant.entity.js";
export type { OrgUser, OrgUserRole } from "./domain/entities/org-user.entity.js";
export { TenantConflictError } from "./domain/errors/tenant-conflict.error.js";
export { UserConflictError } from "./domain/errors/user-conflict.error.js";
export { UserForbiddenError } from "./domain/errors/user-forbidden.error.js";
export { EmitenteFiscalConfigError } from "./domain/errors/emitente-fiscal-config.error.js";
export type { EmitenteEmissaoOverride } from "./domain/value-objects/emitente-emissao-override.js";
export { chaveEmissaoFromOverride } from "./domain/value-objects/emitente-emissao-override.js";
export type { CreateTenantCommand } from "./application/dto/create-tenant.command.js";
export type { UpdateTenantCommand } from "./application/dto/update-tenant.command.js";
export type { CreateUserCommand } from "./application/dto/create-user.command.js";
export type { UpdateUserCommand } from "./application/dto/update-user.command.js";
export {
  resolveEmitenteFiscal,
  resolveTransferenciaEmitenteId,
  type EmitenteFiscalPapel,
} from "./application/services/emitente-fiscal-resolver.service.js";
export {
  normalizeFiscalRoleIds,
  syncEmitenteFiscalFlags,
} from "./application/services/sync-emitente-fiscal-flags.service.js";
export {
  aplicarPapelEmitenteFilial,
  aplicarPapelEmitenteTenant,
} from "./application/services/emitente-fiscal-papeis.service.js";
export { createOrgModule } from "./infrastructure/factory/org-module.factory.js";
export { mapTenant, mapTenantFromPrisma } from "./infrastructure/prisma/tenant-prisma.mapper.js";
export { mapOrgUserFromPrisma } from "./infrastructure/prisma/org-user-prisma.mapper.js";
export { isPrismaUniqueError } from "./infrastructure/prisma/prisma-errors.js";
export {
  mapEmitente,
  mapEmitenteFromFilial,
} from "./infrastructure/fiscal/tenant-emitente.mapper.js";
export {
  tenantCreateBody,
  tenantUpdateBody,
  tenantIdParam,
  type TenantCreateInput,
} from "./presentation/schemas/tenant.schemas.js";
export {
  userCreateBody,
  userUpdateBody,
  userIdParam,
} from "./presentation/schemas/user.schemas.js";
export { tenantController } from "./presentation/controllers/tenant.controller.js";
export { userController } from "./presentation/controllers/user.controller.js";

/**
 * API pública do contexto org para outros módulos. Não reexporta o `OrgModule` (o
 * `app.module.ts` importa pelo caminho dele), para o barrel não criar ciclo com o auth.
 */
export type { EmitenteEmissaoOverride } from "./emitente-fiscal/emitente-emissao-override.js";
export { chaveEmissaoFromOverride } from "./emitente-fiscal/emitente-emissao-override.js";
export { EmitenteFiscalConfigError } from "./emitente-fiscal/emitente-fiscal-config.error.js";
export {
  resolveEmitenteFiscal,
  resolveTransferenciaEmitenteId,
  type EmitenteFiscalPapel,
} from "./emitente-fiscal/emitente-fiscal.resolver.js";
export { mapEmitente, mapEmitenteFromFilial } from "./emitente-fiscal/emitente.mapper.js";
export { OrgError } from "./errors/org.errors.js";
export type { TenantFilial } from "./filial/filial.types.js";
export type { OrgUser, OrgUserRole } from "./member/member.types.js";
export {
  createTenantRequestSchema,
  digitsOnly,
  type CreateTenantRequestDTO,
} from "./tenant/dtos/create-tenant.request.dto.js";
export { mapTenant } from "./tenant/tenant.mapper.js";
export type { EnvironmentKind, Tenant } from "./tenant/tenant.types.js";

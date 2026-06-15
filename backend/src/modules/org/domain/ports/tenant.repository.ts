import type { Tenant } from "../entities/tenant.entity.js";

export type TenantWriteData = Record<string, unknown>;

export type TenantFiscalRoles = {
  emitenteRemessaId?: string | null;
  emitenteTransferenciaId?: string | null;
};

export interface TenantRepository {
  list(): Promise<Tenant[]>;
  findById(id: string): Promise<Tenant | null>;
  findByIdWithFiliais(id: string): Promise<Tenant | null>;
  create(data: TenantWriteData): Promise<Tenant>;
  update(id: string, data: TenantWriteData): Promise<Tenant | null>;
  delete(id: string): Promise<boolean>;
  updateFiscalRoles(tenantId: string, roles: TenantFiscalRoles): Promise<Tenant>;
}

import type { OrgUser } from "../entities/org-user.entity.js";

export type CreateOrgUserData = {
  email: string;
  name?: string;
  passwordHash: string;
};

export type UpdateOrgUserData = {
  email?: string;
  name?: string | null;
  passwordHash?: string;
};

export interface OrgUserRepository {
  listByTenant(tenantId: string): Promise<OrgUser[]>;
  findById(id: string, tenantId: string): Promise<OrgUser | null>;
  create(tenantId: string, data: CreateOrgUserData): Promise<OrgUser>;
  update(id: string, data: UpdateOrgUserData): Promise<OrgUser | null>;
  countByTenant(tenantId: string): Promise<number>;
  delete(id: string): Promise<void>;
}

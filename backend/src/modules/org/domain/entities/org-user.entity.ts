export type OrgUserRole = "ADMIN" | "MEMBER";

export type OrgUser = {
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: OrgUserRole;
  createdAt: string;
  updatedAt: string;
};

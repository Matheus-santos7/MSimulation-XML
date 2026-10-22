/** Base das entidades de domínio que pertencem a um tenant (linha com `tenant_id` e RLS). */
export abstract class TenantIdEntity {
  id!: string;
  tenantId!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

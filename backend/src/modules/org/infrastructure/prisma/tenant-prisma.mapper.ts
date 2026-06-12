import type { Tenant as PrismaTenant } from "../../../../generated/prisma/client.js";
import type { Tenant } from "../../domain/entities/tenant.entity.js";
import { mapTenant } from "../../../../lib/org/tenant-mapper.js";

export function mapTenantFromPrisma(row: PrismaTenant): Tenant {
  return mapTenant(row);
}

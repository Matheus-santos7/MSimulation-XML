import type { CreateTenantCommand } from "./create-tenant.command.js";

export type UpdateTenantCommand = Partial<CreateTenantCommand>;

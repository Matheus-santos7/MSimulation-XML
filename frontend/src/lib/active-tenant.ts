import { cache } from "react";
import { getAuthMe } from "@/lib/auth/session";

/** Tenant do usuário autenticado (JWT). */
export const resolveActiveTenantId = cache(async (): Promise<string | undefined> => {
  const me = await getAuthMe();
  const id = me?.tenantId;
  return id ?? undefined;
});

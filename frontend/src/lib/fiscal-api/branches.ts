import type {
  TenantDto,
  TenantFilialDto,
  TenantFilialInput,
  TenantFiscalRolesInput,
} from "../fiscal-types";
import {
  authHeaders,
  buildApiUrl,
  getJson,
  mutateJson,
  readApiError,
} from "./client";

export async function listBranches(): Promise<TenantFilialDto[]> {
  return getJson<TenantFilialDto[]>(buildApiUrl("/api/empresas/filiais"));
}

export async function createBranch(input: TenantFilialInput): Promise<TenantFilialDto> {
  return mutateJson<TenantFilialDto>(buildApiUrl("/api/empresas/filiais"), "POST", input) as Promise<TenantFilialDto>;
}

export async function updateBranch(
  id: string,
  input: Partial<TenantFilialInput>,
): Promise<TenantFilialDto> {
  return mutateJson<TenantFilialDto>(
    buildApiUrl(`/api/empresas/filiais/${id}`),
    "PUT",
    input,
  ) as Promise<TenantFilialDto>;
}

export async function deleteBranch(id: string): Promise<void> {
  const res = await fetch(buildApiUrl(`/api/empresas/filiais/${id}`), {
    method: "DELETE",
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
}

export async function updateFiscalRoles(input: TenantFiscalRolesInput): Promise<TenantDto> {
  return mutateJson<TenantDto>(buildApiUrl("/api/empresas/papeis-fiscais"), "PATCH", input) as Promise<TenantDto>;
}

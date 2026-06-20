import { cache } from "react";
import type {
  TenantDto,
  TenantInput,
} from "../fiscal-types";
import {
  buildApiUrl,
  getJson,
  getJsonOrNull,
  mutateJson,
} from "./client";

export async function listTenants(): Promise<TenantDto[]> {
  return getJson<TenantDto[]>(buildApiUrl("/api/tenants"));
}

export async function getTenant(id: string): Promise<TenantDto | null> {
  return getJsonOrNull<TenantDto>(buildApiUrl(`/api/tenants/${id}`));
}

export async function createTenant(input: TenantInput): Promise<TenantDto> {
  return mutateJson<TenantDto>(buildApiUrl("/api/tenants"), "POST", input) as Promise<TenantDto>;
}

export async function updateTenant(id: string, input: Partial<TenantInput>): Promise<TenantDto> {
  return mutateJson<TenantDto>(buildApiUrl(`/api/tenants/${id}`), "PATCH", input) as Promise<TenantDto>;
}

export async function deleteTenant(id: string): Promise<void> {
  await mutateJson(buildApiUrl(`/api/tenants/${id}`), "DELETE");
}

/** Uma chamada por request (layout + páginas compartilham o mesmo resultado). */
export const getTenants = cache(listTenants);

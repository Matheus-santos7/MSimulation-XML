import { cache } from "react";
import type {
  UserDto,
  UserInput,
  UserUpdateInput,
} from "../fiscal-types";
import {
  authHeaders,
  buildApiUrl,
  getJson,
  mutateJson,
  readApiError,
} from "./client";

export async function listUsers(): Promise<UserDto[]> {
  return getJson<UserDto[]>(buildApiUrl("/api/users"));
}

export const getUsers = cache(listUsers);

export async function getUser(id: string): Promise<UserDto | null> {
  const href = buildApiUrl(`/api/users/${id}`);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<UserDto>;
}

export async function createUser(input: UserInput): Promise<UserDto> {
  return mutateJson<UserDto>(buildApiUrl("/api/users"), "POST", input) as Promise<UserDto>;
}

export async function updateUser(id: string, input: UserUpdateInput): Promise<UserDto> {
  return mutateJson<UserDto>(buildApiUrl(`/api/users/${id}`), "PATCH", input) as Promise<UserDto>;
}

export async function deleteUser(id: string): Promise<void> {
  await mutateJson(buildApiUrl(`/api/users/${id}`), "DELETE");
}

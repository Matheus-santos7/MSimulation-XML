"use server";

import { resolveAccessToken } from "@/lib/auth/session";

/** Token Bearer para requisições autenticadas iniciadas no browser. */
export async function getAccessTokenForClient(): Promise<string> {
  const token = await resolveAccessToken();
  if (!token) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
  return token;
}

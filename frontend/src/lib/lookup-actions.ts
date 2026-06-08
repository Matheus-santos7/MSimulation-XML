"use server";

import { getAccessToken } from "@/lib/auth/session";
import { apiBase, apiUrl } from "@/lib/api-base";
import type { CepLookupDto, CnpjLookupDto } from "@/lib/fiscal-types";
import { toUserFacingError } from "@/lib/user-facing-error";

function lookupUrl(path: string): string {
  return apiUrl(path);
}

async function getAuthenticatedJson<T>(href: string): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Sessão expirada. Entre novamente.");
  }

  let res: Response;
  try {
    res = await fetch(href, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Falha ao conectar na API";
    throw new Error(
      String(msg).includes("ECONNREFUSED")
        ? `API indisponível em ${apiBase()}. Rode \`pnpm dev\` na raiz.`
        : msg,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let error = res.statusText;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string };
        error = parsed.error ?? parsed.message ?? text;
      } catch {
        error = text;
      }
    }
    throw new Error(toUserFacingError(error, { status: res.status }));
  }
  return res.json() as Promise<T>;
}

export async function lookupCnpj(cnpj: string): Promise<CnpjLookupDto> {
  const digits = cnpj.replace(/\D/g, "");
  return getAuthenticatedJson<CnpjLookupDto>(lookupUrl(`/api/lookup/cnpj/${digits}`));
}

export async function lookupCep(cep: string): Promise<CepLookupDto> {
  const digits = cep.replace(/\D/g, "");
  return getAuthenticatedJson<CepLookupDto>(lookupUrl(`/api/lookup/cep/${digits}`));
}

"use client";

import { apiUrl } from "@/lib/api-base";
import { getAccessTokenForClient } from "@/lib/auth/actions/access-token";

export function parseContentDispositionFilename(header: string | null): string | undefined {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1];
}

export function sanitizeDownloadFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

/** Fetch autenticado direto ao backend (Bearer via server action). */
export async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessTokenForClient();
  const res = await fetch(apiUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let message = text || `Falha na requisição (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* texto bruto */
    }
    throw new Error(message);
  }

  return res;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = sanitizeDownloadFilename(filename);
  a.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadFromApi(apiPath: string, fallbackFilename: string): Promise<void> {
  const res = await authenticatedFetch(apiPath);
  const blob = await res.blob();
  const filename = parseContentDispositionFilename(res.headers.get("Content-Disposition")) ?? fallbackFilename;
  triggerBlobDownload(blob, filename);
}

export async function openXmlFromApi(apiPath: string): Promise<void> {
  const res = await authenticatedFetch(apiPath);
  const text = await res.text();
  const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

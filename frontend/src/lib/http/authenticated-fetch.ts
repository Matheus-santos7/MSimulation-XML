"use client";

import { toBffPath } from "@/lib/http/bff-path";
import { toUserFacingError } from "@/lib/user-facing-error";

export function parseContentDispositionFilename(header: string | null): string | undefined {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1];
}

export function sanitizeDownloadFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

async function readBffError(res: Response): Promise<string> {
  const text = await res.text().catch(() => res.statusText);
  if (!text) {
    return toUserFacingError(undefined, { status: res.status });
  }
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    const message =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      text;
    return toUserFacingError(message, { status: res.status });
  } catch {
    return toUserFacingError(text, { status: res.status });
  }
}

async function fetchFromBff(apiPath: string): Promise<Response> {
  const res = await fetch(toBffPath(apiPath), { cache: "no-store", credentials: "include" });
  if (!res.ok) {
    throw new Error(await readBffError(res));
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
  const res = await fetchFromBff(apiPath);
  const blob = await res.blob();
  const filename = parseContentDispositionFilename(res.headers.get("Content-Disposition")) ?? fallbackFilename;
  triggerBlobDownload(blob, filename);
}

export async function openXmlFromApi(apiPath: string): Promise<void> {
  const res = await fetchFromBff(apiPath);
  const text = await res.text();
  const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

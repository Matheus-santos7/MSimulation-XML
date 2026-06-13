"use client";

import { fetchAuthenticatedApi } from "@/lib/http/authenticated-fetch.server";

export function parseContentDispositionFilename(header: string | null): string | undefined {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1];
}

export function sanitizeDownloadFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

function bytesFromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
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
  const { bodyBase64, contentDisposition, contentType } = await fetchAuthenticatedApi(apiPath);
  const blob = new Blob([bytesFromBase64(bodyBase64)], {
    type: contentType ?? "application/octet-stream",
  });
  const filename = parseContentDispositionFilename(contentDisposition) ?? fallbackFilename;
  triggerBlobDownload(blob, filename);
}

export async function openXmlFromApi(apiPath: string): Promise<void> {
  const { bodyBase64 } = await fetchAuthenticatedApi(apiPath);
  const text = new TextDecoder().decode(new Uint8Array(bytesFromBase64(bodyBase64)));
  const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

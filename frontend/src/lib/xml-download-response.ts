import { prepareFiscalXmlForDownload } from "@msimulation-xml/fiscal-core";

export function sanitizeDownloadFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

export function buildXmlRouteResponse(
  xml: string,
  filename: string,
  download: boolean,
): { body: string; headers: HeadersInit } {
  const headers: HeadersInit = {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store",
  };
  const body = download ? prepareFiscalXmlForDownload(xml) : xml;
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${sanitizeDownloadFilename(filename)}"`;
  }
  return { body, headers };
}

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
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${sanitizeDownloadFilename(filename)}"`;
  }
  return { body: xml, headers };
}

/** Prefixos permitidos no proxy BFF (evita open proxy). */
const ALLOWED_BFF_PREFIXES = [
  "nfes/",
  "ctes/",
  "fiscal-events/",
  "fiscal-settings/",
  "products/spreadsheet/",
] as const;

/** `/api/nfes/...` → `/api/bff/nfes/...` (preserva query string). */
export function toBffPath(apiPath: string): string {
  const [pathname, search = ""] = apiPath.split("?", 2);
  const normalized = pathname.startsWith("/api/")
    ? pathname.slice("/api/".length)
    : pathname.replace(/^\//, "");
  assertAllowedBffPath(normalized);
  return `/api/bff/${normalized}${search ? `?${search}` : ""}`;
}

export function assertAllowedBffPath(path: string): void {
  const allowed = ALLOWED_BFF_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (!allowed) {
    throw new Error("Caminho de API não permitido.");
  }
}

/** URL base da API — server-only (preferir API_URL em vez de NEXT_PUBLIC_*). */
export function apiBase(): string {
  return (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, `${apiBase()}/`).toString();
}

/** URL base da API acessível no browser (NEXT_PUBLIC_API_URL). */
export function publicApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

export function publicApiUrl(path: string): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, `${publicApiBase()}/`).toString();
}

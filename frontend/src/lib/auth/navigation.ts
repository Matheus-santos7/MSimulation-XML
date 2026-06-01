/** Re-lança redirect/notFound do Next.js — não devem ser tratados como erro de formulário. */
export function rethrowNavigationError(e: unknown): void {
  if (isNavigationError(e)) {
    throw e;
  }
}

export function isNavigationError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const digest = "digest" in e ? String((e as { digest?: unknown }).digest) : "";
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
    return true;
  }
  return e instanceof Error && (e.message === "NEXT_REDIRECT" || e.message === "NEXT_NOT_FOUND");
}

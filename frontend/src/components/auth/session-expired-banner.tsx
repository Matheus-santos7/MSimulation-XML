"use client";

import { useSearchParams } from "next/navigation";

export function SessionExpiredBanner() {
  const params = useSearchParams();
  if (params.get("session") !== "expired") return null;

  return (
    <p
      className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90"
      role="status"
    >
      Sua sessão expirou. Entre novamente para continuar.
    </p>
  );
}

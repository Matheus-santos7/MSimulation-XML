"use client";

import { useSearchParams } from "next/navigation";

export function SessionExpiredBanner() {
  const params = useSearchParams();
  if (params.get("session") !== "expired") return null;

  return (
    <p
      className="rounded-md border border-amber-500/30 px-3 py-2 text-sm text-warning"
      role="status"
    >
      Sua sessão expirou. Entre novamente para continuar.
    </p>
  );
}

"use client";

import { useUrlFilter } from "@/hooks/use-url-filter";
import type { MarketplaceDto } from "@/lib/marketplaces";

/** `<select>` de marketplace que filtra a lista pela URL ao mudar (vazio = todos). */
export function MarketplaceFilterSelect({ marketplaces }: { marketplaces: MarketplaceDto[] }) {
  const { value, change, isPending } = useUrlFilter("marketplace");

  return (
    <label className="min-w-[180px] space-y-1">
      <span className="text-xs text-muted-foreground">
        Marketplace
        {isPending ? <span aria-live="polite"> · atualizando…</span> : null}
      </span>
      <select
        name="marketplace"
        value={value}
        onChange={(event) => change(event.target.value)}
        aria-busy={isPending}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
      >
        <option value="">Todos</option>
        {marketplaces.map((m) => (
          <option key={m.code} value={m.code}>
            {m.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

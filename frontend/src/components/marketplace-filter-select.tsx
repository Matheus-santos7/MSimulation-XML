import type { MarketplaceDto } from "@/lib/marketplaces";

/** `<select name="marketplace">` para formulários GET de filtro (vazio = todos). */
export function MarketplaceFilterSelect({
  marketplaces,
  value,
}: {
  marketplaces: MarketplaceDto[];
  value?: string;
}) {
  return (
    <label className="min-w-[180px] space-y-1">
      <span className="text-xs text-muted-foreground">Marketplace</span>
      <select
        name="marketplace"
        defaultValue={value ?? ""}
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

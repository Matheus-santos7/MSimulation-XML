import { marketplaceLabel } from "@/lib/marketplaces";

/** Marketplace de um pedido, nota ou CD, no mesmo estilo dos badges de status. */
export function MarketplaceBadge({ code }: { code: string | undefined | null }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded bg-accent/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
      {marketplaceLabel(code)}
    </span>
  );
}

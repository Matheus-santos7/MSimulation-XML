import Link from "next/link";
import type { MarketplaceDto } from "@/lib/marketplaces";
import { cn } from "@/lib/utils";

/** "Padrão" = configuração da empresa; cada marketplace herda dela e pode sobrescrever. */
export function MarketplaceSettingsTabs({
  marketplaces,
  active,
}: {
  marketplaces: MarketplaceDto[];
  active: "DEFAULT" | MarketplaceDto["code"];
}) {
  const tabs = [
    { key: "DEFAULT", label: "Padrão", href: "/configuracoes-fiscais" },
    ...marketplaces.map((m) => ({
      key: m.code,
      label: m.faturamentoDisponivel ? m.nome : `${m.nome} (pendente)`,
      href: `/configuracoes-fiscais/marketplaces/${m.code}`,
    })),
  ];

  return (
    <nav aria-label="Configuração por marketplace" className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-px rounded-t-md border border-transparent px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground",
            tab.key === active && "border-border border-b-background bg-background text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

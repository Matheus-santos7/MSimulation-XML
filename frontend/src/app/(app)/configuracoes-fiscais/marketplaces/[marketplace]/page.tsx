import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketplaceSettingsTabs } from "@/components/fiscal-settings/marketplace-settings-tabs";
import { PageHeader } from "@/components/fiscal-ui";
import {
  getFiscalEmitterSettings,
  getMarketplaceBillingSettings,
  listMarketplaces,
} from "@/lib/fiscal-api";
import { isMarketplaceCode } from "@/lib/marketplaces";
import { MarketplaceBillingForm } from "./marketplace-billing-form";

export const metadata: Metadata = { title: "Faturador por marketplace" };

export default async function MarketplaceBillingPage({
  params,
}: {
  params: Promise<{ marketplace: string }>;
}) {
  const { marketplace: code } = await params;
  if (!isMarketplaceCode(code)) notFound();

  const [marketplaces, settings, company] = await Promise.all([
    listMarketplaces(),
    getMarketplaceBillingSettings(code),
    getFiscalEmitterSettings(),
  ]);
  const marketplace = marketplaces.find((m) => m.code === code);
  if (!marketplace) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title={`Faturador — ${marketplace.nome}`}
        subtitle="Cada campo herda o padrão da empresa até você sobrescrever aqui"
      />
      <MarketplaceSettingsTabs marketplaces={marketplaces} active={code} />
      {marketplace.faturamentoDisponivel ? null : (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-700 dark:text-amber-300">
          As regras fiscais de {marketplace.nome} ainda não foram levantadas: pedidos podem ser
          criados como rascunho, mas o faturamento responde &quot;Marketplace ainda não configurado
          para faturamento&quot;. A configuração abaixo já vale quando o perfil for ativado.
        </p>
      )}
      <MarketplaceBillingForm
        marketplace={code}
        overrides={settings.overrides}
        defaults={company?.settings ?? settings.effective}
      />
    </div>
  );
}

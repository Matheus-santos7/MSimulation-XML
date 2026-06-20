import type { Metadata } from "next";
import { PageHeader } from "@/components/fiscal-ui";
import { FiscalValidationInsights } from "@/components/fiscal-validation-insights";
import { Sparkles } from "lucide-react";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getValidationInsights } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "IA Insights" };

export default async function IaPage() {
  await resolveActiveTenantId();
  const insights = await getValidationInsights();

  return (
    <div className="p-6">
      <PageHeader
        title="IA Fiscal Insights"
        subtitle="Validação MCP, rejeições recentes e padrões de erro (últimos 7 dias)"
        actions={
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-widest font-bold text-accent">
            <Sparkles className="size-3" />
            MCP Fiscal Brasil
          </div>
        }
      />

      <FiscalValidationInsights data={insights} />
    </div>
  );
}

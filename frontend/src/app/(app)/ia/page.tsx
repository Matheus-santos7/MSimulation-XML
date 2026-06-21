import type { Metadata } from "next";
import { PageHeader } from "@/components/fiscal-ui";
import { FiscalValidationBackfillButton } from "@/components/fiscal-validation-backfill-button";
import { FiscalValidationInsights } from "@/components/fiscal-validation-insights";
// import { FiscalValidatorStatusBanner } from "@/components/fiscal-validator-status-banner";
import { Sparkles } from "lucide-react";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { isAdminRole } from "@/lib/auth/roles";
import { getAuthMe } from "@/lib/auth/session";
import { getFiscalValidatorStatus, getValidationInsights } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "IA Insights" };

export default async function IaPage() {
  await resolveActiveTenantId();
  const [insights, me, validatorStatus] = await Promise.all([
    getValidationInsights(),
    getAuthMe(),
    getFiscalValidatorStatus(),
  ]);
  const isAdmin = isAdminRole(me?.role);

  return (
    <div className="p-6">
      <PageHeader
        title="IA Insights"
        subtitle="Validação MCP, rejeições e padrões de erro"
        actions={
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <FiscalValidationBackfillButton
                pendingCount={insights.counts.pendingAllTime}
                validatorReachable={validatorStatus.enabled && validatorStatus.reachable}
              />
            ) : null}
            <div className="flex items-center gap-2 text-[12px] uppercase tracking-widest font-bold text-accent">
              MCP Fiscal Brasil
            </div>
          </div>
        }
      />

      {/* {isAdmin ? <FiscalValidatorStatusBanner status={validatorStatus} /> : null} */}

      <FiscalValidationInsights data={insights} />
    </div>
  );
}

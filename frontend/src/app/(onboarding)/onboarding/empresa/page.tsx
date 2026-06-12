import type { Metadata } from "next";
import { onboardingEmpresaAction } from "@/lib/onboarding/actions";
import { PageHeader } from "@/components/fiscal-ui";
import { TenantForm } from "@/components/tenant-form";

export const metadata: Metadata = { title: "Cadastrar empresa" };

export default function OnboardingEmpresaPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Cadastre sua empresa"
        subtitle="Dados do emitente NF-e vinculados à sua conta."
      />
      <TenantForm
        action={onboardingEmpresaAction}
        submitLabel="Cadastrar empresa"
        cancelHref={undefined}
        hideCancel
      />
    </div>
  );
}
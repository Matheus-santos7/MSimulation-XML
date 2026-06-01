import type { Metadata } from "next";
import { onboardingEmpresaAction } from "./actions";
import { PageHeader } from "@/components/fiscal-ui";
import { TenantForm } from "@/components/tenant-form";

export const metadata: Metadata = { title: "Cadastrar empresa" };

export default function OnboardingEmpresaPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Cadastre sua empresa"
        subtitle="Dados do emitente NF-e vinculados à sua conta. Depois você poderá usar o cockpit fiscal."
      />
      <TenantForm
        action={onboardingEmpresaAction}
        submitLabel="Continuar para o cockpit"
        cancelHref={undefined}
        hideCancel
      />
    </div>
  );
}

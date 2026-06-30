import type { Metadata } from "next";
import { OnboardingTenantForm } from "@/components/onboarding-tenant-form";

export const metadata: Metadata = { title: "Cadastrar empresa" };

export default function OnboardingEmpresaPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <OnboardingTenantForm />
    </div>
  );
}

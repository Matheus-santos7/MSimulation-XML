"use client";

import { Building2 } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { EmpresaFormState } from "@/lib/empresa-form";
import { onboardingEmpresaAction } from "@/lib/onboarding/actions";
import {
  EMPRESA_ONBOARDING_DATA_FIELDS,
  resolveEmpresaOnboardingStep,
  validateEmpresaEndereco,
  validateEmpresaIdentificacao,
  type EmpresaOnboardingStep,
} from "@/lib/validate-empresa-form";
import { useTenantFormFields } from "@/hooks/use-tenant-form-fields";
import { OnboardingStepOneDialog } from "@/components/onboarding-step-one-dialog";
import { OnboardingStepThreeDialog } from "@/components/onboarding-step-three-dialog";
import { OnboardingStepTwoDialog } from "@/components/onboarding-step-two-dialog";

const HIDDEN_ON_SUBMIT_FIELDS = [...EMPRESA_ONBOARDING_DATA_FIELDS, "iest", "complemento"] as const;

/**
 * Orquestra o onboarding em três etapas com modais separados sobre um painel de progresso.
 */
export function OnboardingTenantForm() {
  const [state, formAction, pending] = useActionState(onboardingEmpresaAction, {} as EmpresaFormState);
  const [step, setStep] = useState<EmpresaOnboardingStep>(1);
  const [stepErrors, setStepErrors] = useState<Record<string, string[]>>({});

  const mergedFieldErrors = useMemo(
    () => ({ ...stepErrors, ...state.fieldErrors }),
    [stepErrors, state.fieldErrors],
  );

  const controller = useTenantFormFields({
    draft: state.values,
    fieldErrors: mergedFieldErrors,
  });

  useEffect(() => {
    if (state.values || state.fieldErrors) {
      setStep(resolveEmpresaOnboardingStep(state.fieldErrors));
    }
  }, [state.values, state.fieldErrors]);

  function handleContinueFromIdentificacao() {
    const errors = validateEmpresaIdentificacao(controller.form);
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      return;
    }

    setStepErrors({});
    setStep(2);
  }

  function handleContinueFromEndereco() {
    const errors = validateEmpresaEndereco(controller.form);
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      return;
    }

    setStepErrors({});
    setStep(3);
  }

  function handleBackToIdentificacao() {
    setStep(1);
    setStepErrors({});
  }

  function handleBackToEndereco() {
    setStep(2);
    setStepErrors({});
  }

  return (
    <>
      <section className="mx-auto flex w-full max-w-lg flex-col items-center px-2 py-8 text-center sm:max-w-xl sm:py-12 lg:max-w-md lg:items-start lg:px-0 lg:text-left">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
          <Building2 className="size-6" aria-hidden />
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cadastre sua empresa</h1>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
          Preencha os dados do emitente em três etapas: identificação, endereço e confirmação.
        </p>
      </section>

      <OnboardingStepOneDialog
        open={step === 1}
        controller={controller}
        onContinue={handleContinueFromIdentificacao}
      />

      <OnboardingStepTwoDialog
        open={step === 2}
        controller={controller}
        onContinue={handleContinueFromEndereco}
        onBack={handleBackToIdentificacao}
      />

      <OnboardingStepThreeDialog
        open={step === 3}
        pending={pending}
        error={state.error}
        controller={controller}
        hiddenFields={HIDDEN_ON_SUBMIT_FIELDS}
        formAction={formAction}
        onBack={handleBackToEndereco}
      />
    </>
  );
}

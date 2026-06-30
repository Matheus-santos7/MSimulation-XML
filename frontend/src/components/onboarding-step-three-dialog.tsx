"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import type { EmpresaFormValues } from "@/lib/empresa-form";
import type { TenantFormFieldsController } from "@/hooks/use-tenant-form-fields";
import { TenantFormFieldsView } from "@/components/tenant-form-fields";
import { TenantFormReview } from "@/components/tenant-form-review";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ONBOARDING_MODAL_BODY_CLASS,
  ONBOARDING_MODAL_CLASS,
  ONBOARDING_MODAL_FOOTER_CLASS,
  ONBOARDING_MODAL_HEADER_CLASS,
  ONBOARDING_MODAL_OVERLAY_CLASS,
} from "@/components/onboarding-modal-styles";

type Props = {
  open: boolean;
  pending: boolean;
  error?: string;
  controller: TenantFormFieldsController;
  hiddenFields: readonly (keyof EmpresaFormValues)[];
  formAction: (payload: FormData) => void;
  onBack: () => void;
};

/**
 * Modal da etapa 3 do onboarding: revisão dos dados e cadastro final.
 */
export function OnboardingStepThreeDialog({
  open,
  pending,
  error,
  controller,
  hiddenFields,
  formAction,
  onBack,
}: Props) {
  return (
    <Dialog open={open}>
      <DialogContent
        className={ONBOARDING_MODAL_CLASS}
        overlayClassName={ONBOARDING_MODAL_OVERLAY_CLASS}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <form action={formAction} className="contents">
          <DialogHeader className={ONBOARDING_MODAL_HEADER_CLASS}>
            <div className="pr-6">
              <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Etapa 3 de 3</p>
              <DialogTitle className="mt-1 text-lg sm:text-xl">Confirme os dados</DialogTitle>
              <DialogDescription className="mt-1.5 text-[14px]">
                Revise as informações e finalize o cadastro do emitente.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className={`${ONBOARDING_MODAL_BODY_CLASS} space-y-6`}>
            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
                {error}
              </div>
            ) : null}

            <TenantFormReview values={controller.form} />

            <TenantFormFieldsView
              controller={controller}
              idPrefix="onboarding-step-3"
              layout="onboarding"
              sections={["contato"]}
            />

            {hiddenFields.map((field) => (
              <input key={field} type="hidden" name={field} value={controller.form[field]} />
            ))}
          </div>

          <DialogFooter className={`${ONBOARDING_MODAL_FOOTER_CLASS} flex-col-reverse sm:flex-row`}>
            <Button type="button" variant="outline" onClick={onBack} className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 size-4" aria-hidden />
              Voltar
            </Button>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                "Cadastrar empresa"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

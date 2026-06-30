"use client";

import { ArrowRight } from "lucide-react";
import type { TenantFormFieldsController } from "@/hooks/use-tenant-form-fields";
import { TenantFormFieldsView } from "@/components/tenant-form-fields";
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
  controller: TenantFormFieldsController;
  onContinue: () => void;
};

/**
 * Modal da etapa 1 do onboarding: identificação do emitente.
 */
export function OnboardingStepOneDialog({ open, controller, onContinue }: Props) {
  return (
    <Dialog open={open}>
      <DialogContent
        className={ONBOARDING_MODAL_CLASS}
        overlayClassName={ONBOARDING_MODAL_OVERLAY_CLASS}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader className={ONBOARDING_MODAL_HEADER_CLASS}>
          <div className="pr-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Etapa 1 de 3</p>
            <DialogTitle className="mt-1 text-lg sm:text-xl">Dados da empresa</DialogTitle>
            <DialogDescription className="mt-1.5 text-[14px]">
              Informe CNPJ, razão social e regime tributário do emitente.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className={ONBOARDING_MODAL_BODY_CLASS}>
          <TenantFormFieldsView
            controller={controller}
            idPrefix="onboarding-step-1"
            layout="onboarding"
            sections={["identificacao"]}
          />
        </div>

        <DialogFooter className={ONBOARDING_MODAL_FOOTER_CLASS}>
          <p className="hidden text-[12px] text-muted-foreground sm:block">Próxima etapa: endereço</p>
          <Button type="button" onClick={onContinue} className="w-full sm:w-auto">
            Continuar
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

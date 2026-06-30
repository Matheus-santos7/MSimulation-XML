"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EmpresaFormState } from "@/lib/empresa-form";
import { Button } from "@/components/ui/button";
import { TenantFormFields } from "@/components/tenant-form-fields";
import type { TenantDto } from "@/lib/fiscal-types";

type Props = {
  tenant?: TenantDto;
  action: (prev: EmpresaFormState, formData: FormData) => Promise<EmpresaFormState>;
  submitLabel: string;
  cancelHref?: string;
  hideCancel?: boolean;
};

export function TenantForm({
  tenant,
  action,
  submitLabel,
  cancelHref = "/empresas",
  hideCancel = false,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      className="w-full space-y-4 rounded-none border-x-0 border-t border-b border-border bg-card p-4 sm:space-y-6 sm:rounded-lg sm:border sm:p-6 lg:p-8"
    >
      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[14px] text-destructive">
          {state.error}
        </div>
      )}

      <TenantFormFields tenant={tenant} draft={state.values} fieldErrors={state.fieldErrors} idPrefix="nova" />

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:pt-6">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Salvando…" : submitLabel}
        </Button>
        {!hideCancel && cancelHref ? (
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link href={cancelHref}>Cancelar</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

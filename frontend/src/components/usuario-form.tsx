"use client";

import { useActionState } from "react";
import Link from "next/link";
import { UsuarioFormFields } from "@/components/usuario-form-fields";
import { Button } from "@/components/ui/button";
import type { UsuarioFormState } from "@/lib/usuario-form";
import type { UserDto } from "@/lib/fiscal-types";

type Props = {
  user?: UserDto;
  action: (prev: UsuarioFormState, formData: FormData) => Promise<UsuarioFormState>;
  submitLabel: string;
  cancelHref?: string;
  mode?: "create" | "edit";
};

export function UsuarioForm({
  user,
  action,
  submitLabel,
  cancelHref = "/usuarios",
  mode = user ? "edit" : "create",
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4 border border-border rounded-lg bg-card p-6">
      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[14px] text-destructive">
          {state.error}
        </div>
      )}

      <UsuarioFormFields
        user={user}
        draft={state.values}
        fieldErrors={state.fieldErrors}
        idPrefix={user ? `edit-${user.id}` : "novo-usuario"}
        mode={mode}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

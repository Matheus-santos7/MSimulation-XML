"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateMyAccountAction } from "@/lib/auth/actions";
import type { UsuarioFormState } from "@/lib/usuario-form";
import { PASSWORD_POLICY_HINT } from "@/lib/auth/password-policy";

type Props = {
  email: string;
  initialName: string;
};

export function AccountProfileForm({ email, initialName }: Props) {
  const router = useRouter();
  const initial: UsuarioFormState = {
    values: { email, name: initialName, password: "" },
  };
  const [state, formAction, pending] = useActionState(updateMyAccountAction, initial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  const values = state.values ?? initial.values!;

  return (
    <form action={formAction} className="space-y-4 max-w-md">
      <input type="hidden" name="email" value={email} />
      <div className="space-y-1.5">
        <label htmlFor="account-email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="account-email"
          type="email"
          value={email}
          readOnly
          tabIndex={-1}
          className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">O e-mail de login não pode ser alterado aqui.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="account-name" className="text-sm font-medium">
          Nome
        </label>
        <input
          id="account-name"
          name="name"
          type="text"
          defaultValue={values.name}
          autoComplete="name"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="account-password" className="text-sm font-medium">
          Nova senha
        </label>
        <input
          id="account-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Deixe em branco para manter"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-success" role="status">
          Perfil atualizado.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}

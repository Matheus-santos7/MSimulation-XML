"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ForgotPasswordState } from "@/lib/auth/actions";

const initial: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initial);

  if (state.success) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm text-foreground">{state.success}</p>
        <p className="text-xs text-muted-foreground">
          Verifique a caixa de entrada e o spam. O link expira em breve.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent text-accent-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}

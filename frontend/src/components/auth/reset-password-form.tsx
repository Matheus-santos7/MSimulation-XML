"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "@/lib/auth/actions";
import { PASSWORD_POLICY_HINT } from "@/lib/auth/password-policy";

const initial: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  if (state.success) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm text-foreground">{state.success}</p>
        <Link
          href="/login"
          className="inline-block w-full text-center rounded-md bg-accent text-accent-foreground py-2.5 text-sm font-semibold hover:opacity-90"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="text-sm font-medium">
          Nova senha
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          Confirmar senha
        </label>
        <input
          id="confirm-password"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="totp-code" className="text-sm font-medium">
          Código do autenticador
        </label>
        <input
          id="totp-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="000000"
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm tracking-[0.3em] text-center font-mono focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <p className="text-xs text-muted-foreground">
          Obrigatório se a autenticação em duas etapas estiver ativa na sua conta.
        </p>
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
        {pending ? "Salvando…" : "Redefinir senha"}
      </button>
    </form>
  );
}

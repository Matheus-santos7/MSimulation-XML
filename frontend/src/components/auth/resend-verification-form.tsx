"use client";

import { useActionState } from "react";
import { resendVerificationAction, type ResendVerificationState } from "@/lib/auth/actions";

const initial: ResendVerificationState = {};

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(resendVerificationAction, initial);

  return (
    <form action={action} className="space-y-3">
      {state.success ? (
        <p className="text-sm text-emerald-500" role="status">
          {state.success}
        </p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md border border-border py-2.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Reenviar e-mail de confirmação"}
      </button>
    </form>
  );
}

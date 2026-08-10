"use client";

import { useActionState, useEffect, useState } from "react";
import { verify2faAction, type Verify2faState } from "@/lib/auth/actions";
import { RegisterCaptchaField, isTurnstileRequired } from "@/components/auth/register-captcha-field";

const initial: Verify2faState = {};

export function Verify2faForm() {
  const [state, formAction, pending] = useActionState(verify2faAction, initial);
  const [captchaReady, setCaptchaReady] = useState(!isTurnstileRequired());

  useEffect(() => {
    if (!state.redirectTo) return;
    // Hard navigation garante que os cookies Set-Cookie da Server Action sejam
    // enviados no próximo document request (mais confiável que router.replace em prod).
    window.location.assign(state.redirectTo);
  }, [state.redirectTo]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="totp-code" className="text-sm font-medium">
          Código
        </label>
        <input
          id="totp-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="000000"
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm tracking-[0.3em] text-center font-mono focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      <RegisterCaptchaField onReadyChange={setCaptchaReady} />
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.redirectTo ? (
        <p className="text-sm text-muted-foreground" role="status">
          Código confirmado. Redirecionando…
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !captchaReady || Boolean(state.redirectTo)}
        className="w-full rounded-md bg-accent text-accent-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {state.redirectTo ? "Redirecionando…" : pending ? "Verificando…" : "Confirmar"}
      </button>
    </form>
  );
}

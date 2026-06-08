"use client";

import { useCallback, useEffect } from "react";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

/** Sincroniza token Turnstile com campo hidden do formulário pai. */
export function RegisterCaptchaField() {
  const syncToken = useCallback((token: string) => {
    const field = document.getElementById("captcha-token-field") as HTMLInputElement | null;
    if (field) field.value = token;
  }, []);

  useEffect(() => {
    syncToken("");
  }, [syncToken]);

  return <TurnstileWidget onToken={syncToken} />;
}

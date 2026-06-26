"use client";

import { useCallback, useState } from "react";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

export function isTurnstileRequired(): boolean {
  return Boolean(turnstileSiteKey);
}

type RegisterCaptchaFieldProps = {
  onReadyChange?: (ready: boolean) => void;
};

/**
 * Turnstile nos formulários de auth, com callback de prontidão para o submit.
 */
export function RegisterCaptchaField({ onReadyChange }: RegisterCaptchaFieldProps) {
  const [isReady, setIsReady] = useState(!turnstileSiteKey);

  const handleToken = useCallback(
    (token: string) => {
      const ready = !turnstileSiteKey || token.length >= 10;
      setIsReady(ready);
      onReadyChange?.(ready);
    },
    [onReadyChange],
  );

  return (
    <div className="space-y-1.5">
      <TurnstileWidget onToken={handleToken} />
      {turnstileSiteKey && !isReady ? (
        <p className="text-xs text-muted-foreground">Aguardando verificação de segurança…</p>
      ) : null}
    </div>
  );
}

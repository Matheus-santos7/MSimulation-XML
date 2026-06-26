"use client";

import { useCallback, useEffect, useState } from "react";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

export function isTurnstileRequired(): boolean {
  return Boolean(turnstileSiteKey);
}

type RegisterCaptchaFieldProps = {
  /** Incrementado a cada troca de aba para forçar novo desafio Turnstile. */
  turnstileKey?: number;
  onReadyChange?: (ready: boolean) => void;
};

/**
 * Turnstile nos formulários de auth, com callback de prontidão para o submit.
 */
export function RegisterCaptchaField({
  turnstileKey = 0,
  onReadyChange,
}: RegisterCaptchaFieldProps) {
  const [isReady, setIsReady] = useState(!turnstileSiteKey);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setIsReady(!turnstileSiteKey);
    setLoadError(false);
    onReadyChange?.(!turnstileSiteKey);
  }, [turnstileKey, onReadyChange]);

  const handleToken = useCallback(
    (token: string) => {
      const ready = !turnstileSiteKey || token.length >= 10;
      setIsReady(ready);
      if (ready) setLoadError(false);
      onReadyChange?.(ready);
    },
    [onReadyChange],
  );

  const handleError = useCallback(() => {
    setLoadError(true);
    setIsReady(false);
    onReadyChange?.(false);
  }, [onReadyChange]);

  return (
    <div className="space-y-1.5">
      <TurnstileWidget
        key={turnstileKey}
        instanceKey={turnstileKey}
        onToken={handleToken}
        onError={handleError}
      />
      {turnstileSiteKey && !isReady && !loadError ? (
        <p className="text-xs text-muted-foreground">Aguardando verificação de segurança…</p>
      ) : null}
      {loadError ? (
        <p className="text-xs text-destructive" role="alert">
          Não foi possível carregar a verificação de segurança. Recarregue a página e tente novamente.
        </p>
      ) : null}
    </div>
  );
}

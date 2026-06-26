"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type Props = {
  onToken: (token: string) => void;
};

/**
 * Widget Cloudflare Turnstile com campo hidden controlado por React.
 */
export function TurnstileWidget({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  const handleToken = useCallback(
    (value: string) => {
      setToken(value);
      onToken(value);
    },
    [onToken],
  );

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: handleToken,
      "expired-callback": () => handleToken(""),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, handleToken, scriptReady]);

  if (!siteKey) {
    if (process.env.NODE_ENV === "production") {
      return (
        <p className="text-xs text-destructive" role="alert">
          Verificação de segurança indisponível. Contate o suporte.
        </p>
      );
    }
    return null;
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <input type="hidden" name="captchaToken" value={token} readOnly />
      <div ref={containerRef} className="min-h-[65px]" aria-label="Verificação de segurança" />
    </>
  );
}

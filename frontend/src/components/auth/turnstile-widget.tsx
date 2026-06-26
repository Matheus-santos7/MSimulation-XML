"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      ready: (callback: () => void) => void;
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (errorCode?: string) => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

type Props = {
  onToken: (token: string) => void;
  onError?: () => void;
};

/**
 * Widget Cloudflare Turnstile (renderização explícita) com campo hidden controlado por React.
 */
export function TurnstileWidget({ onToken, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);
  const [token, setToken] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  const emitToken = useCallback((value: string) => {
    setToken(value);
    onTokenRef.current(value);
  }, []);

  const markScriptReady = useCallback(() => {
    setScriptReady(true);
  }, []);

  useEffect(() => {
    if (window.turnstile) {
      markScriptReady();
    }
  }, [markScriptReady]);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current) return;

    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;

      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        size: "normal",
        callback: (value) => {
          if (!cancelled) emitToken(value);
        },
        "expired-callback": () => {
          if (!cancelled) emitToken("");
        },
        "error-callback": () => {
          if (!cancelled) {
            emitToken("");
            onErrorRef.current?.();
          }
        },
      });
    };

    window.turnstile.ready(mountWidget);

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, scriptReady, emitToken]);

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
        id={TURNSTILE_SCRIPT_ID}
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={markScriptReady}
        onReady={markScriptReady}
      />
      <input type="hidden" name="captchaToken" value={token} readOnly />
      <div ref={containerRef} className="min-h-[65px]" aria-label="Verificação de segurança" />
    </>
  );
}

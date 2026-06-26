"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
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

let turnstileScriptPromise: Promise<void> | null = null;

/**
 * Carrega o script do Turnstile sem async/defer (exigência da API explícita).
 */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      if (window.turnstile) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile load failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile load failed"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

type Props = {
  /** Identificador da instância; alterar força remount do widget. */
  instanceKey: number;
  onToken: (token: string) => void;
  onError?: () => void;
};

/**
 * Widget Cloudflare Turnstile (renderização explícita) com campo hidden controlado por React.
 */
export function TurnstileWidget({ instanceKey, onToken, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const [token, setToken] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  const emitToken = useCallback((value: string) => {
    setToken(value);
    onTokenRef.current(value);
  }, []);

  useEffect(() => {
    setToken("");
    onTokenRef.current("");
  }, [instanceKey]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;

      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      containerRef.current.replaceChildren();

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

    loadTurnstileScript()
      .then(() => {
        if (!cancelled) mountWidget();
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, instanceKey, emitToken]);

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
      <input type="hidden" name="captchaToken" value={token} readOnly />
      <div ref={containerRef} className="min-h-[65px]" aria-label="Verificação de segurança" />
    </>
  );
}

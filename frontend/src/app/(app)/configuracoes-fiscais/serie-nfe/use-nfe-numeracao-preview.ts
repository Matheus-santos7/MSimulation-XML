"use client";

import { useEffect, useRef, useState } from "react";
import { fetchJsonFromBff } from "@/lib/http/authenticated-fetch";
import type { NfeNumeracaoView } from "@/lib/fiscal-emitter-settings-types";

function parseSerie(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 999) return null;
  return Math.trunc(n);
}

function parseNumeroInicial(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 999_999_999) return null;
  return Math.trunc(n);
}

/**
 * Preview de numeração via backend (respeita inutilizações).
 * Debounce ao mudar série ou número inicial.
 */
export function useNfeNumeracaoPreview(
  serie: string,
  numeroInicial: string,
  initial: NfeNumeracaoView,
): { numeracao: NfeNumeracaoView; loading: boolean; error: string | null } {
  const [numeracao, setNumeracao] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipFetchRef = useRef(true);

  const initialSignature = `${initial.numeroInicial}|${initial.ultimoEmitido}|${initial.proximoNumero}`;

  useEffect(() => {
    setNumeracao(initial);
    skipFetchRef.current = true;
  }, [initial, initialSignature]);

  useEffect(() => {
    const parsedSerie = parseSerie(serie);
    const parsedInicial = parseNumeroInicial(numeroInicial);
    if (parsedSerie == null || parsedInicial == null) return;

    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      setNumeracao((prev) => ({
        ...prev,
        numeroInicial: parsedInicial,
      }));
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          serie: String(parsedSerie),
          numeroInicial: String(parsedInicial),
        });
        const preview = await fetchJsonFromBff<NfeNumeracaoView>(
          `/api/fiscal-settings/nfe-numeracao?${params.toString()}`,
        );
        if (cancelled) return;
        setNumeracao(preview);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro ao carregar numeração");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [serie, numeroInicial]);

  return { numeracao, loading, error };
}

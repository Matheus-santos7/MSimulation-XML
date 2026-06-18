"use client";

import { useEffect, useRef, useState } from "react";
import { fetchJsonFromBff } from "@/lib/http/authenticated-fetch";
import type { NfeNumeracaoView } from "@/lib/fiscal-emitter-settings-types";

function computeProximoNumeroLocal(ultimoEmitido: number | null, numeroInicial: number): number {
  const floor = Math.max(1, Math.trunc(numeroInicial) || 1);
  if (ultimoEmitido == null || ultimoEmitido <= 0) return floor;
  return Math.max(ultimoEmitido + 1, floor);
}

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
 * Busca preview de numeração no backend quando a série muda; recalcula próximo número localmente
 * quando apenas a numeração inicial é alterada.
 */
export function useNfeNumeracaoPreview(
  serie: string,
  numeroInicial: string,
  initial: NfeNumeracaoView,
): { numeracao: NfeNumeracaoView; loading: boolean; error: string | null } {
  const [numeracao, setNumeracao] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ultimoEmitidoRef = useRef<number | null>(initial.ultimoEmitido);
  const skipSerieFetchRef = useRef(true);

  const initialSignature = `${initial.numeroInicial}|${initial.ultimoEmitido}|${initial.proximoNumero}`;

  useEffect(() => {
    setNumeracao(initial);
    ultimoEmitidoRef.current = initial.ultimoEmitido;
    skipSerieFetchRef.current = true;
  }, [initial, initialSignature]);

  useEffect(() => {
    const parsedSerie = parseSerie(serie);
    const parsedInicial = parseNumeroInicial(numeroInicial);
    if (parsedSerie == null || parsedInicial == null) return;

    if (skipSerieFetchRef.current) {
      skipSerieFetchRef.current = false;
      setNumeracao((prev) => ({
        ...prev,
        numeroInicial: parsedInicial,
        proximoNumero: computeProximoNumeroLocal(ultimoEmitidoRef.current, parsedInicial),
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
        ultimoEmitidoRef.current = preview.ultimoEmitido;
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
  }, [serie]);

  useEffect(() => {
    const parsedInicial = parseNumeroInicial(numeroInicial);
    if (parsedInicial == null) return;

    setNumeracao((prev) => ({
      ...prev,
      numeroInicial: parsedInicial,
      proximoNumero: computeProximoNumeroLocal(ultimoEmitidoRef.current, parsedInicial),
    }));
  }, [numeroInicial]);

  return { numeracao, loading, error };
}

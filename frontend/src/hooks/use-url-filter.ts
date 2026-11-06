"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const TEXT_FILTER_DEBOUNCE_MS = 300;

type UseUrlFilterOptions = {
  /** 0 aplica na hora (select); use `TEXT_FILTER_DEBOUNCE_MS` para campo de texto. */
  debounceMs?: number;
};

/**
 * Liga um filtro a um parâmetro da URL sem recarregar a página: troca a query com
 * `router.replace` dentro de uma transição, então a tela atual fica no lugar (com `isPending`)
 * até o servidor devolver a lista filtrada.
 *
 * shortcut: o valor local só nasce da URL; voltar/avançar no histórico não o ressincroniza.
 * Upgrade quando algum filtro precisar reagir a mudança de URL feita por outro componente.
 */
export function useUrlFilter(name: string, { debounceMs = 0 }: UseUrlFilterOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get(name) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const apply = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = next.trim();
      if (trimmed) params.set(name, trimmed);
      else params.delete(name);

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [name, pathname, router, searchParams],
  );

  const change = useCallback(
    (next: string) => {
      setValue(next);
      clearTimeout(timer.current);
      if (debounceMs > 0) {
        timer.current = setTimeout(() => apply(next), debounceMs);
        return;
      }
      apply(next);
    },
    [apply, debounceMs],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { value, change, isPending };
}

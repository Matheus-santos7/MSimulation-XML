"use client";

import { TEXT_FILTER_DEBOUNCE_MS, useUrlFilter } from "@/hooks/use-url-filter";
import { cn } from "@/lib/utils";

type UrlFilterInputProps = {
  name: string;
  label: string;
  placeholder?: string;
  /** Sugestões do `<datalist>` (ex.: nomes de regra já cadastrados). */
  suggestions?: readonly string[];
  className?: string;
  inputClassName?: string;
};

/** Campo de texto que filtra a lista pela URL, com debounce e sem botão "Filtrar". */
export function UrlFilterInput({
  name,
  label,
  placeholder,
  suggestions,
  className,
  inputClassName,
}: UrlFilterInputProps) {
  const { value, change, isPending } = useUrlFilter(name, { debounceMs: TEXT_FILTER_DEBOUNCE_MS });
  const listId = suggestions ? `${name}-sugestoes` : undefined;

  return (
    <label className={cn("space-y-1", className)}>
      <span className="text-xs text-muted-foreground">
        {label}
        {isPending ? <span aria-live="polite"> · atualizando…</span> : null}
      </span>
      <input
        name={name}
        value={value}
        list={listId}
        placeholder={placeholder}
        onChange={(event) => change(event.target.value)}
        aria-busy={isPending}
        className={cn(
          "w-full rounded border border-border bg-background px-2 py-1.5 text-sm",
          inputClassName,
        )}
      />
      {suggestions && listId ? (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

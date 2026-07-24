import { cn } from "@/lib/utils";

/** Base comum dos ícones de ação na lista de NF-e (tamanho + anel). */
export const nfeTableActionBtn =
  "size-8 shrink-0 ring-1 disabled:opacity-30 disabled:bg-transparent disabled:ring-0 disabled:hover:bg-transparent";

export function nfeTableActionClass(tone: "muted" | "destructive" | "blue" | "amber" | "teal" | "indigo") {
  const tones = {
    muted: "text-muted-foreground hover:text-foreground hover:bg-muted/60 ring-border/60",
    destructive:
      "text-destructive bg-destructive/10 hover:bg-destructive/20 hover:text-destructive ring-destructive/30",
    blue: "text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-500 ring-blue-500/30",
    amber: "text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-500 ring-amber-500/30",
    teal: "text-teal-600 bg-teal-500/10 hover:bg-teal-500/20 hover:text-teal-500 ring-teal-500/30",
    indigo:
      "text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 hover:text-indigo-500 ring-indigo-500/30",
  } as const;
  return cn(nfeTableActionBtn, tones[tone]);
}

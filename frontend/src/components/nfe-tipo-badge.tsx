import type { NFeDto } from "@/lib/fiscal-types";

export type NfeTipoDisplay = NFeDto["tipo"] | "INUTILIZACAO";

const TIPO_LABELS: Record<NfeTipoDisplay, string> = {
  REMESSA: "Remessa",
  REMESSA_SIMBOLICA: "Remessa simb.",
  RETORNO_SIMBOLICO: "Retorno",
  VENDA: "Venda",
  DEVOLUCAO: "Devolução",
  INUTILIZACAO: "Inutilização",
};

export function NfeTipoBadge({ tipo }: { tipo: NfeTipoDisplay }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {TIPO_LABELS[tipo]}
    </span>
  );
}

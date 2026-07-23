import type { NFeDto } from "@/lib/fiscal-types";

export type NfeTipoDisplay = NFeDto["tipo"] | "INUTILIZACAO";

const TIPO_LABELS: Record<NfeTipoDisplay, string> = {
  REMESSA: "Remessa",
  REMESSA_SIMBOLICA: "Remessa simb.",
  REMESSA_AVANCO: "Remessa avanço",
  RETORNO_SIMBOLICO: "Retorno",
  RETORNO_FISICO: "Retorno físico",
  VENDA: "Venda",
  DEVOLUCAO: "Devolução",
  /** Enum API: `INSULCESSO_DE_ENTREGA`; label UI: Insucesso (português correto). */
  INSULCESSO_DE_ENTREGA: "Insucesso",
  TRANSFERENCIA_FILIAL: "Transf. filial",
  INUTILIZACAO: "Inutilização",
};

export function NfeTipoBadge({ tipo }: { tipo: NfeTipoDisplay }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {TIPO_LABELS[tipo]}
    </span>
  );
}

import type { NFeDto } from "@/lib/fiscal-types";

const LABELS = {
  PENDING: "Validação pendente",
  APPROVED: "XML aprovado",
  REJECTED: "XML rejeitado",
} as const;

const TONES = {
  PENDING: "bg-muted text-muted-foreground border-border",
  APPROVED: "bg-success/10 text-success border-success/30",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/30",
} as const;

type Props = {
  status: NFeDto["validationStatus"];
};

/** Badge de status da validação MCP do XML da NF-e. */
export function NfeValidationBadge({ status }: Props) {
  const resolved = status ?? "PENDING";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONES[resolved]}`}
      title={LABELS[resolved]}
    >
      {LABELS[resolved]}
    </span>
  );
}

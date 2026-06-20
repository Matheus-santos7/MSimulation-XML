import type { NfeMcpAuditDto } from "@/lib/fiscal-types";

type Props = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  message?: string;
  audit?: NfeMcpAuditDto;
};

const SEVERITY_STYLES: Record<string, string> = {
  critico: "border-destructive/40 bg-destructive/10 text-destructive",
  alto: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  medio: "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
};

/** Painel com retorno completo da auditoria MCP persistida no banco. */
export function NfeValidationAuditPanel({ status, message, audit }: Props) {
  if (status === "PENDING" && !audit) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <p className="text-sm font-semibold">Validação MCP — pendente</p>
        {message ? <p className="text-sm text-muted-foreground mt-1">{message}</p> : null}
      </div>
    );
  }

  if (!audit) {
    return null;
  }

  const panelTone =
    status === "REJECTED"
      ? "border-destructive/40 bg-destructive/5"
      : status === "APPROVED"
        ? "border-success/40 bg-success/5"
        : "border-border bg-card";

  return (
    <div className={`rounded-md border p-4 space-y-4 ${panelTone}`}>
      <div>
        <p className="text-sm font-semibold">
          Validação MCP — {status === "APPROVED" ? "aprovado" : status === "REJECTED" ? "rejeitado" : "pendente"}
        </p>
        {(audit.resumo || message) && (
          <p className="text-sm text-muted-foreground mt-1">{audit.resumo || message}</p>
        )}
      </div>

      {audit.achados.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
            Achados ({audit.achados.length})
          </h4>
          <ul className="space-y-2">
            {audit.achados.map((achado) => (
              <li
                key={`${achado.codigo}-${achado.mensagem}`}
                className={`rounded-md border px-3 py-2 text-sm ${SEVERITY_STYLES[achado.severidade] ?? "border-border bg-background"}`}
              >
                <div className="font-mono text-xs uppercase tracking-wide opacity-80">
                  {achado.severidade} · {achado.codigo}
                </div>
                <div className="mt-1">{achado.mensagem}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum achado registrado.</p>
      )}

      {audit.erros.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            Erros brutos ({audit.erros.length})
          </summary>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
            {audit.erros.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

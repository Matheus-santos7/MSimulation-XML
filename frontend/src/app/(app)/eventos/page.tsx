import type { Metadata } from "next";
import { FiscalEventXmlActions } from "@/components/fiscal-xml-actions";
import { NfeInutilizarForm } from "@/components/nfe-inutilizar-form";
import { PageHeader } from "@/components/fiscal-ui";
import { getFiscalEmitterSettings, listFiscalEvents } from "@/lib/fiscal-api";
import { formatChave } from "@/lib/format";

export const metadata: Metadata = { title: "Eventos SEFAZ" };

const EVENT_NAMES: Record<string, string> = {
  "110111": "Cancelamento",
  "110110": "Carta de Correção",
  INUT: "Inutilização de numeração",
  "210200": "Confirmação da operação",
  "210210": "Ciência da operação",
  "210220": "Desconhecimento da operação",
  "210240": "Operação não realizada",
};

export default async function EventosPage() {
  const [events, cfg] = await Promise.all([
    listFiscalEvents(),
    getFiscalEmitterSettings(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Eventos SEFAZ" subtitle="Cancelamentos, inutilizações e demais eventos persistidos" />

      <NfeInutilizarForm seriePadrao={cfg?.serieRemessa ?? 5} />

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {events.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhum evento para este tenant.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Referência</th>
                <th className="px-4 py-3 font-medium">Protocolo</th>
                <th className="px-4 py-3 font-medium">Ocorrido em</th>
                <th className="px-4 py-3 font-medium text-right">XML</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 font-mono text-[13px] text-accent">{e.tipo}</td>
                  <td className="px-4 py-3">
                    <div>{EVENT_NAMES[e.tipo] ?? e.descricao}</div>
                    {e.xJust && (
                      <div className="text-[12px] text-muted-foreground mt-0.5 max-w-md truncate" title={e.xJust}>
                        {e.xJust}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-muted-foreground">
                    {e.tipo === "INUT" && e.serie != null ? (
                      <>
                        Série {e.serie} — nº {e.numeroIni}
                        {e.numeroFim !== e.numeroIni ? ` a ${e.numeroFim}` : ""}
                      </>
                    ) : e.chaveRef ? (
                      formatChave(e.chaveRef)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">{e.protocolo}</td>
                  <td className="px-4 py-3 text-[14px]">{new Date(e.ocorridoEm).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <FiscalEventXmlActions event={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

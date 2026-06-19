import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader, StatusBadge } from "@/components/fiscal-ui";
import { TimelineChains } from "@/components/timeline-chains";
import { TimelineExportButton } from "@/components/timeline-export-button";
import { listNfes, listTimeline } from "@/lib/fiscal-api";
import { brl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Simulação de operações Mercado Livre Full.",
};

export default async function DashboardPage() {
  const [nfes, timeline] = await Promise.all([listNfes(), listTimeline()]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-6 overflow-hidden p-6">
      <div className="shrink-0 border border-border rounded-lg bg-card overflow-hidden animate-slide-in">
        <SectionHeader
          title="Timeline — Cenários de NF-e"
          right={<TimelineExportButton />}
        />
        <TimelineChains groups={timeline} layout="rows" />
      </div>

      <div className="flex-1 min-h-0 border border-border rounded-lg bg-card overflow-hidden animate-slide-in flex flex-col">
        <SectionHeader
          title="Últimas Notas Fiscais"
          right={
            <Link
              href="/nfe"
              className="text-[12px] font-bold uppercase tracking-wider text-accent hover:underline"
            >
              Ver todas
            </Link>
          }
        />
        {nfes.length === 0 ? (
          <div className="p-6 text-muted-foreground text-[14px]">
            Nenhuma NF-e para esta empresa.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border">
                  <th className="px-4 py-3 font-medium">NF-e</th>
                  <th className="px-4 py-3 font-medium">Destinatário</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nfes.map((nfe, i) => (
                  <tr
                    key={nfe.chave}
                    className={`hover:bg-foreground/[0.02] transition-colors ${
                      i === 0 ? "border-l-2 border-l-accent" : ""
                    }`}
                  >
                    <td
                      className={`px-4 py-3 font-mono text-[13px] ${
                        i === 0 ? "text-accent/80" : "text-muted-foreground"
                      }`}
                    >
                      <Link href={`/nfe/${nfe.numero}/${nfe.serie}`} className="hover:underline">
                        {nfe.numero}/{nfe.serie}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{nfe.destinatario.nome}</div>
                      <div className="text-[12px] text-muted-foreground font-mono">{nfe.destinatario.doc}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{brl(nfe.valor)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={nfe.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

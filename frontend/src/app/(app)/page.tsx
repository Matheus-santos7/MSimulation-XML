import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader, StatusBadge } from "@/components/fiscal-ui";
import { TimelineChains } from "@/components/timeline-chains";
import { TimelineExportButton } from "@/components/timeline-export-button";
import { listNfes, listTimeline } from "@/lib/fiscal-api";
import { brl } from "@/lib/format";
import { panelSurfaceClass } from "@/lib/ui/shell-styles";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Simulação de operações Mercado Livre Full.",
};

export default async function DashboardPage() {
  const [nfes, timeline] = await Promise.all([listNfes(), listTimeline()]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden p-4 lg:p-5">
      <header className="shrink-0 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Cenários de remessa e últimas NF-e da empresa ativa.
          </p>
        </div>
      </header>

      <section className={`${panelSurfaceClass()} shrink-0 max-h-[42%] flex flex-col`}>
        <SectionHeader
          title="Timeline — Cenários de NF-e"
          right={<TimelineExportButton />}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <TimelineChains groups={timeline} layout="rows" />
        </div>
      </section>

      <section className={`${panelSurfaceClass()} flex-1 min-h-0 flex flex-col`}>
        <SectionHeader
          title="Últimas notas fiscais"
          right={
            <Link
              href="/nfe"
              className="text-sm font-medium text-accent hover:underline underline-offset-4"
            >
              Ver todas
            </Link>
          }
        />
        {nfes.length === 0 ? (
          <div className="p-6 text-muted-foreground text-sm">
            Nenhuma NF-e para esta empresa.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border/70">
                  <th className="px-4 py-2 font-medium">NF-e</th>
                  <th className="px-4 py-2 font-medium">Destinatário</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {nfes.map((nfe) => (
                  <tr key={nfe.chave} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2 font-mono text-[13px] text-muted-foreground">
                      <Link
                        href={`/nfe/${nfe.chave}`}
                        className="hover:text-accent hover:underline underline-offset-2"
                      >
                        {nfe.numero}/{nfe.serie}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-sm leading-tight">{nfe.destinatario.nome}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {nfe.destinatario.doc}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-sm tabular-nums">{brl(nfe.valor)}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={nfe.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

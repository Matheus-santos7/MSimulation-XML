import type { Metadata } from "next";
import Link from "next/link";
import { KPI, SectionHeader, StatusBadge } from "@/components/fiscal-ui";
import { TimelineChains } from "@/components/timeline-chains";
import { listNfes, listTimeline } from "@/lib/fiscal-api";
import { brl, formatChave } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Simulação de operações Mercado Livre Full.",
};

export default async function DashboardPage() {
  const [nfes, timeline] = await Promise.all([listNfes(), listTimeline()]);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KPI label="Notas emitidas" value={String(nfes.length)} hint="Notas emitidas" hintTone="success" />
        <KPI
          label="Cenários fiscais"
          value={String(timeline.reduce((acc, g) => acc + g.cenarios.length, 0))}
          hint={`${timeline.filter((g) => g.remessaChave).length} remessa(s) · cenários`}
          hintTone="accent"
        />
        <KPI label="Conformidade" value="100%" hint="Simulação" hintTone="success" />
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-8 border border-border rounded-lg bg-card overflow-hidden animate-slide-in">
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
            <table className="w-full text-left border-collapse">
              <thead>
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
                    className={`hover:bg-white/2 transition-colors ${
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
          )}
        </div>

        <div className="col-span-4 space-y-6">
          <div className="border border-border rounded-lg bg-card animate-slide-in">
            <SectionHeader title="Timeline — Cenários de NF-e" />
            <TimelineChains groups={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}

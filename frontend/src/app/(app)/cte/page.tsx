import type { Metadata } from "next";
import Link from "next/link";
import { CteXmlActions } from "@/components/fiscal-xml-actions";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { listCtes } from "@/lib/fiscal-api";
import { brl } from "@/lib/format";

export const metadata: Metadata = { title: "CT-e" };

export default async function CTePage() {
  const ctes = await listCtes();

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-6 overflow-hidden p-6">
      <div className="shrink-0">
        <PageHeader
          className="mb-0"
          title="CT-e Transportes"
        />
      </div>

      <div className="flex-1 min-h-0 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
        {ctes.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhum CT-e para esta empresa.</div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full min-w-[1040px] text-left border-collapse table-fixed">
              <colgroup>
                <col className="w-[75px]" />
                <col className="w-[70px]" />
                <col className="w-[330px]" />
                <col />
                <col className="w-[108px]" />
                <col className="w-[120px]" />
                <col className="w-[108px]" />
                <col className="w-[48px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border bg-muted/30">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Nº / Série</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">NF-e ref.</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Chave de acesso</th>
                  <th className="px-4 py-3 font-medium">Origem → Destino</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Valor frete</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">XML</th>
                  <th className="px-4 py-3 font-medium" aria-label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ctes.map((c) => (
                  <tr key={c.chave} className="hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap">
                      <Link href={`/cte/${c.chave}`} className="text-accent hover:underline">
                        {c.numero}/{c.serie}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap">
                      {c.nfeChaveRef && c.nfeNumeroRef != null && c.nfeSerieRef != null ? (
                        <Link href={`/nfe/${c.nfeChaveRef}`} className="text-accent hover:underline">
                          {c.nfeNumeroRef}/{c.nfeSerieRef}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-0">
                      <Link
                        href={`/cte/${c.chave}`}
                        className="font-mono text-[11px] leading-relaxed text-muted-foreground hover:text-accent whitespace-nowrap"
                        title={c.chave}
                      >
                        {c.chave}
                      </Link>
                    </td>
                    <td className="px-4 py-3 min-w-0">
                      <div
                        className="text-[13px] truncate"
                        title={`${c.origem} → ${c.destino}`}
                      >
                        <span className="text-muted-foreground">{c.origem}</span>
                        <span className="mx-1 text-muted-foreground/50">→</span>
                        <span>{c.destino}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.modal}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap">{brl(c.valor)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <CteXmlActions chave={c.chave} variant="list" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteConfirmButton variant="cte" chave={c.chave} label={`CT-e ${c.numero}`} />
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

import type { Metadata } from "next";
import Link from "next/link";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { NfeCancelarButton } from "@/components/nfe-cancelar-button";
import { NfeDevolucaoButton } from "@/components/nfe-devolucao-button";
import { NfeInutXmlActions, NfeXmlActions } from "@/components/fiscal-xml-actions";
import { NfeTipoBadge } from "@/components/nfe-tipo-badge";
import { InutilizadaStatusBadge, PageHeader, StatusBadge } from "@/components/fiscal-ui";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listFiscalEvents, listNfes } from "@/lib/fiscal-api";
import type { FiscalEventDto } from "@/lib/fiscal-types";
import { brl } from "@/lib/format";
import { buildNfeTableRows, formatNumeroSerie } from "@/lib/nfe-table-rows";

export const metadata: Metadata = { title: "NF-e Emitidas" };

export default async function NFeListPage() {
  const tenantId = await resolveActiveTenantId();
  const [nfesRaw, eventos] = await Promise.all([listNfes(), listFiscalEvents()]);
  const rows = buildNfeTableRows(nfesRaw, eventos);

  const cancelamentoPorChave = new Map<string, FiscalEventDto>();
  for (const e of eventos) {
    if (e.tipo === "110111" && e.chaveRef) {
      cancelamentoPorChave.set(e.chaveRef, e);
    }
  }

  const vendasDevolvidas = new Set(
    nfesRaw
      .filter((n) => n.tipo === "DEVOLUCAO" && n.nfeReferenciaChave)
      .map((n) => n.nfeReferenciaChave as string),
  );

  const vendasCanceladas = new Set(
    nfesRaw.filter((n) => n.tipo === "VENDA" && n.status === "CANCELADA").map((n) => n.chave),
  );

  return (
    <div className="p-6">
      <PageHeader
        title="NF-e Emitidas"
        subtitle="Sequência fiscal por série e número — inclui faixas inutilizadas"
      />

      <div className="border border-border rounded-lg bg-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhuma NF-e ou inutilização para esta empresa.</div>
        ) : (
          <table className="w-full min-w-[1100px] text-left border-collapse">
            <thead>
              <tr className="text-[12px] text-muted-foreground uppercase tracking-tighter border-b border-border bg-muted/30">
                <th className="px-4 py-3 font-medium whitespace-nowrap">Nº / Série</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Emitida em</th>
                {/* <th className="px-4 py-3 font-medium min-w-[280px]">Chave de acesso</th> */}
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">CFOP</th>
                <th className="px-4 py-3 font-medium">Qtd</th>
                <th className="px-4 py-3 font-medium">Destinatário</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">XML</th>
                <th className="px-4 py-3 font-medium text-right w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                if (row.kind === "inut") {
                  const { inut } = row;
                  const nFim = inut.numeroFim ?? inut.numeroIni!;
                  return (
                    <tr key={`inut-${inut.id}`} className="hover:bg-foreground/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono text-[13px]">
                        {formatNumeroSerie(inut.serie!, inut.numeroIni!, nFim)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">
                        {new Date(inut.ocorridoEm).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground/50">—</td>
                      <td className="px-4 py-3">
                        <NfeTipoBadge tipo="INUTILIZACAO" />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground/50">—</td>
                      <td className="px-4 py-3 text-muted-foreground/50">—</td>
                      <td className="px-4 py-3 text-muted-foreground/50">—</td>
                      <td className="px-4 py-3 text-muted-foreground/50">—</td>
                      <td className="px-4 py-3">
                        <InutilizadaStatusBadge />
                      </td>
                      <td className="px-4 py-3">
                        <NfeInutXmlActions inutId={inut.id} />
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  );
                }

                const nfe = row.nfe;

                return (
                  <tr key={nfe.chave} className="hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-[13px]">
                      <Link href={`/nfe/${nfe.chave}`} className="text-accent hover:underline">
                        {nfe.numero}/{nfe.serie}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">
                      {new Date(nfe.emitidaEm).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    {/* <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground leading-relaxed break-all select-all">
                      {nfe.chave}
                    </td> */}
                    <td className="px-4 py-3">
                      <NfeTipoBadge tipo={nfe.tipo} />
                    </td>
                    <td className="px-4 py-3 font-mono">{nfe.cfop}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {nfe.quantidade}
                      {(nfe.tipo === "REMESSA" || nfe.tipo === "REMESSA_AVANCO") && (
                        <span
                          className={`block text-[11px] font-semibold mt-0.5 ${
                            (nfe.saldoDisponivel ?? 0) > 0
                              ? "text-green-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          saldo {nfe.saldoDisponivel ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium max-w-[200px] truncate" title={nfe.destinatario.nome}>
                        {nfe.destinatario.nome}
                      </div>
                      <div className="text-[12px] text-muted-foreground font-mono">
                        {nfe.destinatario.doc} • {nfe.destinatario.uf}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">{brl(nfe.valor)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={nfe.status} />
                    </td>
                    <td className="px-4 py-3">
                      <NfeXmlActions
                        chave={nfe.chave}
                        status={nfe.status}
                        cancelamentoEvent={cancelamentoPorChave.get(nfe.chave)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {nfe.tipo === "VENDA" && (
                          <>
                            <NfeCancelarButton
                              chave={nfe.chave}
                              label={`${nfe.numero}/${nfe.serie}`}
                              desabilitado={
                                nfe.status === "CANCELADA" ||
                                vendasDevolvidas.has(nfe.chave) ||
                                nfe.status !== "AUTORIZADA"
                              }
                              motivoDesabilitado={
                                nfe.status === "CANCELADA"
                                  ? "Venda já cancelada"
                                  : vendasDevolvidas.has(nfe.chave)
                                    ? "Venda com devolução emitida"
                                    : nfe.status !== "AUTORIZADA"
                                      ? "Só NF-e autorizadas podem ser canceladas"
                                      : undefined
                              }
                            />
                            <NfeDevolucaoButton
                              chave={nfe.chave}
                              label={`${nfe.numero}/${nfe.serie}`}
                              jaDevolvida={
                                vendasDevolvidas.has(nfe.chave) || vendasCanceladas.has(nfe.chave)
                              }
                            />
                          </>
                        )}
                        <DeleteConfirmButton
                          variant="nfe"
                          chave={nfe.chave}
                          label={`${nfe.numero}/${nfe.serie}`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

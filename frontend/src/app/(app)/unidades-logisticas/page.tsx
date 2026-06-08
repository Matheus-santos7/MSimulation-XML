import type { Metadata } from "next";
import { PageHeader } from "@/components/fiscal-ui";
import { UnidadesLogisticasTable } from "@/components/unidades-logisticas-table";
import { listUnidadesLogisticas } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Unidades Logísticas" };

type Props = {
  searchParams: Promise<{ q?: string; cnpj?: string }>;
};

export default async function UnidadesLogisticasPage({ searchParams }: Props) {
  const { q, cnpj } = await searchParams;

  const unidades = await listUnidadesLogisticas({
    q: q?.trim() || undefined,
    cnpj: cnpj?.trim() || undefined,
    ativa: true,
  });

  const padrao = unidades.find((u) => u.padrao);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Unidades Logísticas"
        subtitle="Catálogo global Meli Full — cada empresa define o CD padrão para remessas"
      />

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          padrao ? "border-accent/30 bg-accent/5" : "border-border bg-muted/30"
        }`}
      >
        {padrao ? (
          <p>
            <span className="text-muted-foreground">CD padrão de remessa da sua empresa: </span>
            <span className="font-medium">
              {padrao.codigo} — {padrao.nome} ({padrao.endereco.municipio}/{padrao.endereco.uf})
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">
            Nenhum CD padrão definido. Clique em &quot;Usar como padrão&quot; na unidade que sua empresa
            utiliza — será o destino das remessas automáticas de produtos.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <form className="flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-[200px] space-y-1">
            <span className="text-xs text-muted-foreground">Buscar código, nome ou UF</span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Ex.: SP02, Cajamar, SC"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex-1 min-w-[200px] space-y-1">
            <span className="text-xs text-muted-foreground">CNPJ</span>
            <input
              name="cnpj"
              defaultValue={cnpj ?? ""}
              placeholder="Ex.: 12.345.678/0001-99"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Filtrar
          </button>
        </form>
        <UnidadesLogisticasTable unidades={unidades} />
      </div>
    </div>
  );
}

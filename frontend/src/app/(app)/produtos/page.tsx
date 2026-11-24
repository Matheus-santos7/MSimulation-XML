import type { Metadata } from "next";
import { PageHeader } from "@/components/fiscal-ui";
import { ListPager } from "@/components/list-pager";
import { ProdutoCard } from "@/components/produto-card";
import { ProdutoNovoSheet } from "@/components/produto-novo-sheet";
import { ProdutoPlanilhaToolbar } from "@/components/produto-planilha-toolbar";
import { UrlFilterInput } from "@/components/url-filter-input";
import { listProductsPage, listTaxRuleCatalog } from "@/lib/fiscal-api";
import { PAGE_PARAM, fetchPageWithin, parsePageParam } from "@/lib/paginate";

export const metadata: Metadata = { title: "Produtos" };

const PRODUCTS_PER_PAGE = 30;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProdutosPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const buscaRaw = Array.isArray(params.busca) ? params.busca[0] : params.busca;
  const busca = buscaRaw?.trim() ?? "";
  const [page, taxRuleCatalog] = await Promise.all([
    fetchPageWithin(parsePageParam(params[PAGE_PARAM]), (n) =>
      listProductsPage(n, PRODUCTS_PER_PAGE, busca || undefined),
    ),
    listTaxRuleCatalog(),
  ]);
  const produtos = page.data;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Catálogo de Produtos"
        actions={<ProdutoNovoSheet taxRuleCatalog={taxRuleCatalog} />}
      />

      <ProdutoPlanilhaToolbar hasProducts={page.total > 0 || busca !== ""} />

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3">
        <UrlFilterInput
          name="busca"
          label="Buscar por SKU ou nome"
          placeholder="Ex.: 300002137 ou Fogão"
          className="w-[320px]"
          inputClassName="h-9 px-3"
        />
      </div>

      {produtos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {busca ? (
              <>Nenhum produto encontrado para “{busca}”.</>
            ) : (
              <>
                Nenhum produto para esta empresa. Clique em <strong>Novo produto</strong>, importe
                uma planilha ou baixe o modelo CSV acima.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map((p) => (
            <ProdutoCard key={p.id} product={p} taxRuleCatalog={taxRuleCatalog} />
          ))}
        </div>
      )}

      {page.totalPages > 1 ? (
        <ListPager
          pathname="/produtos"
          query={busca ? { busca } : {}}
          page={page.page}
          totalPages={page.totalPages}
          totalItems={page.total}
          itemLabel="produtos"
        />
      ) : null}
    </div>
  );
}

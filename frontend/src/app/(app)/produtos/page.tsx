import type { Metadata } from "next";
import { PageHeader } from "@/components/fiscal-ui";
import { ProdutoCard } from "@/components/produto-card";
import { ProdutoNovoSheet } from "@/components/produto-novo-sheet";
import { ProdutoPlanilhaToolbar } from "@/components/produto-planilha-toolbar";
import { listProducts, listTaxRuleCatalog } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProdutosPage() {
  const [produtos, taxRuleCatalog] = await Promise.all([
    listProducts(),
    listTaxRuleCatalog(),
  ]);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Catálogo de Produtos"
        subtitle="Itens NF-e — bloco &lt;prod&gt; (cProd, NCM, CEST, preço…)"
        actions={<ProdutoNovoSheet taxRuleCatalog={taxRuleCatalog} />}
      />

      <ProdutoPlanilhaToolbar products={produtos} />

      {produtos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum produto para esta empresa. Clique em <strong>Novo produto</strong>, importe uma
            planilha ou baixe o modelo CSV acima.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map((p) => (
            <ProdutoCard key={p.id} product={p} taxRuleCatalog={taxRuleCatalog} />
          ))}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/fiscal-ui";
import { ProdutoCard } from "@/components/produto-card";
import { ProdutoPlanilhaToolbar } from "@/components/produto-planilha-toolbar";
import { Button } from "@/components/ui/button";
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
        subtitle="Itens NF-e — bloco &lt;prod&gt; (cProd, NCM, CEST, CFOP, preço…)"
        actions={
          <Button asChild>
            <Link href="/produtos/novo">Novo produto</Link>
          </Button>
        }
      />

      <ProdutoPlanilhaToolbar products={produtos} />

      {produtos.length === 0 ? (
        <div className="text-muted-foreground">
          Nenhum produto para esta empresa. Importe uma planilha,{" "}
          <Link href="/produtos/novo" className="text-accent hover:underline">
            cadastre manualmente
          </Link>{" "}
          ou baixe o modelo CSV acima.
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

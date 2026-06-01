import type { Metadata } from "next";
import Link from "next/link";
import { createProdutoAction } from "../actions";
import { PageHeader } from "@/components/fiscal-ui";
import { ProductForm } from "@/components/product-form";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { listTaxRuleCatalog } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  const tenantId = await resolveActiveTenantId();
  const taxRuleCatalog = await listTaxRuleCatalog();

  return (
    <div className="p-6">
      <Link
        href="/produtos"
        className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← Voltar
      </Link>
      <PageHeader title="Novo produto" subtitle="Cadastro para o bloco &lt;prod&gt; da NF-e" />
      <ProductForm action={createProdutoAction} submitLabel="Criar produto" taxRuleCatalog={taxRuleCatalog} />
    </div>
  );
}

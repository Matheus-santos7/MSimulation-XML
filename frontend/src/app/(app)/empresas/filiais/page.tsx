import type { Metadata } from "next";
import Link from "next/link";
import { FilialForm } from "@/components/filial-form";
import { FilialList } from "@/components/filial-list";
import { PageHeader } from "@/components/fiscal-ui";
import { listFiliais, listUnidadesLogisticas } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Filiais" };

export default async function FiliaisPage() {
  const [filiais, unidades] = await Promise.all([
    listFiliais(),
    listUnidadesLogisticas({ ativa: true }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <Link
        href="/empresas"
        className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← Empresas
      </Link>
      <PageHeader
        title="Filiais"
        subtitle="Estabelecimentos vinculados à matriz para transferência interna e remessa automática ao CD"
      />

      <FilialForm unidades={unidades} />
      <FilialList filiais={filiais} unidades={unidades} />
    </div>
  );
}

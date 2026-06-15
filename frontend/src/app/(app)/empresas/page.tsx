import type { Metadata } from "next";
import Link from "next/link";
import { EmitentePapeisForm } from "@/components/emitente-papeis-form";
import { FiliaisSection } from "@/components/filiais-section";
import { PageHeader } from "@/components/fiscal-ui";
import { EmpresaCard } from "@/components/empresa-card";
import { getTenants, listUnidadesLogisticas } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Empresas" };

export default async function EmpresasPage() {
  const [tenants, unidades] = await Promise.all([
    getTenants(),
    listUnidadesLogisticas({ ativa: true }),
  ]);

  const tenant = tenants[0];
  const filiais = tenant?.filiais ?? [];

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Empresas"
        subtitle="Matriz, filiais e definição de quem emite remessas e transferências"
      />

      {tenants.length === 0 ? (
        <div className="text-muted-foreground">
          Nenhuma empresa vinculada.{" "}
          <Link href="/onboarding/empresa" className="text-accent hover:underline">
            Cadastrar empresa
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Matriz</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tenants.map((t) => (
                <EmpresaCard key={t.id} tenant={t} />
              ))}
            </div>
          </section>

          {tenant && (
            <>
              <FiliaisSection filiais={filiais} unidades={unidades} />
              <EmitentePapeisForm tenant={tenant} filiais={filiais} />
            </>
          )}
        </>
      )}
    </div>
  );
}

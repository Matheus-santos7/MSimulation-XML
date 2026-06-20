import type { Metadata } from "next";
import Link from "next/link";
import { EmitentePapeisForm } from "@/components/emitente-papeis-form";
import { FiliaisSection, SectionHeading } from "@/components/filiais-section";
import { PageHeader } from "@/components/fiscal-ui";
import { EmpresaCard } from "@/components/empresa-card";
import { getTenants, listLogisticUnits } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Empresas" };

export default async function EmpresasPage() {
  const [tenants, unidades] = await Promise.all([
    getTenants(),
    listLogisticUnits({ ativa: true }),
  ]);

  const tenant = tenants[0];
  const filiais = tenant?.filiais ?? [];

  return (
    <div className="p-6 space-y-10 max-w-5xl">
      <PageHeader
        title="Empresas"
        subtitle="Matriz, filiais e definição de quem emite remessas e transferências"
      />

      {tenants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground">
          Nenhuma empresa vinculada.{" "}
          <Link href="/onboarding/empresa" className="text-accent hover:underline">
            Cadastrar empresa
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <SectionHeading
              title="Matriz"
              subtitle="Cadastro principal do emitente vinculado à sua conta"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tenants.map((t) => (
                <EmpresaCard key={t.id} tenant={t} />
              ))}
            </div>
          </section>

          {tenant && (
            <>
              <FiliaisSection tenant={tenant} filiais={filiais} unidades={unidades} />

              <section className="space-y-4">
                <SectionHeading
                  title="Papéis fiscais"
                  subtitle="Qual estabelecimento emite remessas e transferências de estoque"
                />
                <EmitentePapeisForm tenant={tenant} filiais={filiais} />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

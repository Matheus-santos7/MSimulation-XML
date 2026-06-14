import type { Metadata } from "next";
import Link from "next/link";
import { EmitentePapeisTenantForm } from "@/components/emitente-papeis-tenant-form";
import { PageHeader } from "@/components/fiscal-ui";
import { EmpresaCard } from "@/components/empresa-card";
import { getTenants } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Empresas" };

export default async function EmpresasPage() {
  const tenants = await getTenants();

  return (
    <div className="p-6">
      <PageHeader title="Empresas" subtitle="Emitente vinculado à sua conta" />
      <p className="text-sm text-muted-foreground mb-4">
        <Link href="/empresas/filiais" className="text-accent hover:underline">
          Gerenciar filiais da matriz
        </Link>
      </p>
      {tenants.length === 0 ? (
        <div className="text-muted-foreground">
          Nenhuma empresa vinculada.{" "}
          <Link href="/onboarding/empresa" className="text-accent hover:underline">
            Cadastrar empresa
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {tenants.map((t) => (
              <EmpresaCard key={t.id} tenant={t} />
            ))}
          </div>
          {tenants[0] && <EmitentePapeisTenantForm tenant={tenants[0]} />}
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { OperacoesTabs } from "@/components/operacoes-tabs";
import { PageHeader } from "@/components/fiscal-ui";
import { listBranches, listProducts, listLogisticUnits, getTenants } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Operações de fulfillment" };

export default async function OperacoesPage() {
  const [products, unidades, filiais, tenants] = await Promise.all([
    listProducts(),
    listLogisticUnits({ ativa: true }),
    listBranches(),
    getTenants(),
  ]);
  const tenant = tenants[0];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Remessas"
        subtitle="Remessas físicas, transferências entre filiais, avanço de CD e remessas simbólicas"
      />

      <OperacoesTabs
        products={products}
        unidades={unidades}
        filiais={filiais}
        emitenteTransferenciaId={tenant?.emitenteTransferenciaId}
      />
    </div>
  );
}

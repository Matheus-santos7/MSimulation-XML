"use client";

import { AvancoCdForm } from "@/components/avanco-cd-form";
import { RemessaManualForm } from "@/components/remessa-manual-form";
import { TransferenciaFilialForm } from "@/components/transferencia-filial-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { ProductDto, TenantFilialDto } from "@/lib/fiscal-types";

const TABS = [
  { id: "transferencia", label: "Transferência filial" },
  { id: "remessa", label: "Remessa física" },
  { id: "avanco", label: "Avanço CD" },
] as const;

type Props = {
  products: ProductDto[];
  unidades: UnidadeLogisticaDto[];
  filiais: TenantFilialDto[];
};

export function OperacoesTabs({ products, unidades, filiais }: Props) {
  return (
    <Tabs defaultValue="transferencia" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap justify-start">
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="transferencia">
        <TransferenciaFilialForm products={products} filiais={filiais} />
      </TabsContent>

      <TabsContent value="remessa">
        <RemessaManualForm products={products} unidades={unidades} />
      </TabsContent>

      <TabsContent value="avanco">
        <AvancoCdForm products={products} unidades={unidades} />
      </TabsContent>

    </Tabs>
  );
}

"use client";

import Link from "next/link";
import { AvancoCdForm } from "@/components/avanco-cd-form";
import { RemessaManualForm } from "@/components/remessa-manual-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { ProductDto } from "@/lib/fiscal-types";

const TABS = [
  { id: "remessa", label: "Remessa física" },
  { id: "transferencia", label: "Transferência filial" },
  { id: "avanco", label: "Avanço CD" },
  { id: "simbolica", label: "Remessa simbólica" },
] as const;

type Props = {
  products: ProductDto[];
  unidades: UnidadeLogisticaDto[];
};

export function OperacoesTabs({ products, unidades }: Props) {
  return (
    <Tabs defaultValue="remessa" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap justify-start">
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="remessa">
        <RemessaManualForm products={products} unidades={unidades} />
      </TabsContent>

      <TabsContent value="transferencia">
        <PlaceholderFase
          titulo="Transferência entre filiais"
          fase={2}
          detalhe="Cadastro de filial emitente, transferência interna e remessa subsequente ao CD."
        />
      </TabsContent>

      <TabsContent value="avanco">
        <AvancoCdForm products={products} unidades={unidades} />
      </TabsContent>

      <TabsContent value="simbolica">
        <PlaceholderFase
          titulo="Remessa simbólica avulsa"
          fase={3}
          detalhe="Hoje emitida no fluxo de devolução e avanço CD; UI dedicada em fase futura."
        />
      </TabsContent>
    </Tabs>
  );
}

function PlaceholderFase({
  titulo,
  fase,
  detalhe,
  linkHref,
  linkLabel,
}: {
  titulo: string;
  fase: number;
  detalhe: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground space-y-2">
      <p className="font-medium text-foreground">{titulo}</p>
      <p>{detalhe}</p>
      <p className="text-xs uppercase tracking-widest">Fase {fase} — em planejamento</p>
      {linkHref && linkLabel && (
        <Link href={linkHref} className="inline-block text-accent hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FilialCard } from "@/components/filial-card";
import { FilialForm } from "@/components/filial-form";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { TenantDto, TenantFilialDto } from "@/lib/fiscal-types";

type Props = {
  tenant: TenantDto;
  filiais: TenantFilialDto[];
  unidades: UnidadeLogisticaDto[];
};

function resolvePapeis(
  tenant: TenantDto,
  filialId: string,
): { remessa?: boolean; transferencia?: boolean } {
  const remessaId = tenant.emitenteRemessaId;
  const transferenciaId = tenant.emitenteTransferenciaId;
  return {
    remessa: remessaId === filialId,
    transferencia: transferenciaId === filialId,
  };
}

export function FiliaisSection({ tenant, filiais, unidades }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title="Filiais"
          subtitle="Estabelecimentos com CNPJ próprio vinculados à matriz"
        />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" size="sm">
              <Plus className="size-4 mr-1" />
              Adicionar filial
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Nova filial</SheetTitle>
              <SheetDescription>
                Cadastre um estabelecimento filial com CNPJ e endereço completos.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <FilialForm
                embedded
                unidades={unidades}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {filiais.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma filial cadastrada. Clique em &quot;Adicionar filial&quot; para incluir um
            estabelecimento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filiais.map((f) => (
            <FilialCard
              key={f.id}
              filial={f}
              unidades={unidades}
              papeis={resolvePapeis(tenant, f.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
        {title}
      </h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

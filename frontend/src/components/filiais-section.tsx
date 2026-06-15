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
import { FilialForm } from "@/components/filial-form";
import { FilialList } from "@/components/filial-list";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { TenantFilialDto } from "@/lib/fiscal-types";

type Props = {
  filiais: TenantFilialDto[];
  unidades: UnidadeLogisticaDto[];
};

export function FiliaisSection({ filiais, unidades }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Filiais</h2>
          <p className="text-sm text-muted-foreground">
            Estabelecimentos com CNPJ próprio vinculados à matriz.
          </p>
        </div>
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
                unidades={unidades}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {filiais.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-4">
          Nenhuma filial cadastrada. Use &quot;Adicionar filial&quot; para incluir um estabelecimento.
        </p>
      ) : (
        <FilialList filiais={filiais} unidades={unidades} />
      )}
    </div>
  );
}

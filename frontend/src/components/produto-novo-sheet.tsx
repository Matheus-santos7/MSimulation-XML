"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createProdutoAction } from "@/app/(app)/produtos/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProductFormFields } from "@/components/product-form-fields";
import type { TaxRuleCatalogEntry } from "@/lib/fiscal-types";

type Props = {
  taxRuleCatalog: TaxRuleCatalogEntry[];
};

export function ProdutoNovoSheet({ taxRuleCatalog }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button">
          <Plus className="size-4 mr-1" />
          Novo produto
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Novo produto</SheetTitle>
          <SheetDescription>
            Cadastro manual para o bloco &lt;prod&gt; da NF-e (SKU, NCM, regra fiscal, preços).
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <NovoProdutoForm
            taxRuleCatalog={taxRuleCatalog}
            onCancel={() => setOpen(false)}
            onSaved={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NovoProdutoForm({
  taxRuleCatalog,
  onCancel,
  onSaved,
}: {
  taxRuleCatalog: TaxRuleCatalogEntry[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createProdutoAction, {});

  useEffect(() => {
    if (state.success) {
      onSaved();
      router.refresh();
    }
  }, [state.success, onSaved, router]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[14px] text-destructive">
          {state.error}
        </div>
      )}

      <ProductFormFields
        draft={state.values}
        fieldErrors={state.fieldErrors}
        idPrefix="novo-prod"
        taxRuleCatalog={taxRuleCatalog}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Criar produto"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

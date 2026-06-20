"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { faturarPedidoAction, salvarPedidoRascunhoAction } from "@/app/(app)/pedidos/actions";
import { lookupCep } from "@/lib/lookup-actions";
import type { PedidoDto, ProductDto } from "@/lib/fiscal-types";
import {
  PEDIDO_FORM_EMPTY,
  findPedidoFormExample,
  pedidoToFormValues,
  type PedidoFormValues,
} from "@/lib/pedido-form";

export const PEDIDO_WIZARD_STEPS = ["Produto", "Comprador", "Endereço", "Revisão"] as const;

type UsePedidoWizardOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductDto[];
  pedido?: PedidoDto;
};

/**
 * Estado e handlers do wizard de pedido ML (rascunho + faturamento).
 */
export function usePedidoWizard({ open, onOpenChange, products, pedido }: UsePedidoWizardOptions) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PedidoFormValues>(PEDIDO_FORM_EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [exampleId, setExampleId] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedExample = exampleId ? findPedidoFormExample(exampleId) : undefined;
  const isEdit = Boolean(pedido);
  const selected = products.find((p) => p.id === form.productId);
  const qty = Math.max(1, Number(form.quantidade) || 1);
  const total = selected ? selected.preco * qty : 0;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    setExampleId("");
    if (pedido) {
      setForm(pedidoToFormValues(pedido));
    } else {
      setForm({
        ...PEDIDO_FORM_EMPTY,
        productId: products[0]?.id ?? "",
      });
    }
  }, [open, pedido, products]);

  const set = (key: keyof PedidoFormValues, value: string) => setForm((f) => ({ ...f, [key]: value }));

  function applyExample(id: string) {
    const example = findPedidoFormExample(id);
    if (!example) return;
    setExampleId(id);
    setForm((current) => ({
      ...example.values,
      productId: current.productId || products[0]?.id || "",
      quantidade: current.quantidade || "1",
    }));
  }

  function submit(saveOnly: boolean) {
    setError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.set(k, v);
    if (pedido?.id) fd.set("pedidoId", pedido.id);

    startTransition(async () => {
      const result = saveOnly
        ? await salvarPedidoRascunhoAction({}, fd)
        : await faturarPedidoAction({}, fd);

      if (result.error) {
        setError(result.error);
        return;
      }
      if (saveOnly) {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  async function onLookupCep() {
    setCepLoading(true);
    try {
      const data = await lookupCep(form.cep);
      setForm((f) => ({
        ...f,
        cep: data.cep,
        logradouro: data.logradouro || f.logradouro,
        bairro: data.bairro || f.bairro,
        municipio: data.municipio || f.municipio,
        codigoMunicipio: data.codigoMunicipio ?? f.codigoMunicipio,
        uf: data.uf || f.uf,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  return {
    step,
    setStep,
    form,
    set,
    error,
    cepLoading,
    exampleId,
    setExampleId,
    pending,
    selectedExample,
    isEdit,
    selected,
    qty,
    total,
    applyExample,
    submit,
    onLookupCep,
  };
}

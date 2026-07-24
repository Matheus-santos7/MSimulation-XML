"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { faturarPedidoAction, salvarPedidoRascunhoAction } from "@/app/(app)/pedidos/actions";
import { lookupCep } from "@/lib/lookup-actions";
import type { PedidoDto, ProductDto } from "@/lib/fiscal-types";
import { mergePedidoBuyerExample } from "@/lib/merge-pedido-buyer-example";
import { gerarPedidoMlClient } from "@/lib/gerar-pedido-ml";
import {
  PEDIDO_FORM_EMPTY,
  PEDIDO_ITEM_EMPTY,
  findPedidoFormExample,
  pedidoToFormValues,
  type PedidoFormValues,
  type PedidoItemFormValues,
} from "@/lib/pedido-form";

export const PEDIDO_WIZARD_STEPS = ["Produtos", "Frete", "Comprador", "Endereço", "Revisão"] as const;

export const PEDIDO_WIZARD_LAST_STEP = PEDIDO_WIZARD_STEPS.length - 1;

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

  const parseMoney = (raw: string): number => {
    const n = Number(String(raw).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  };

  const lineTotals = form.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const qty = Math.max(1, Number(item.quantidade) || 1);
    const desconto = parseMoney(item.desconto);
    const subtotal = product ? product.preco * qty : 0;
    const total = Math.max(0, Math.round((subtotal - desconto) * 100) / 100);
    return { product, qty, desconto, subtotal, total };
  });

  const subtotal = lineTotals.reduce((acc, line) => acc + line.subtotal, 0);
  const desconto = lineTotals.reduce((acc, line) => acc + line.desconto, 0);
  const freteConsumidor = parseMoney(form.freteConsumidor);
  const freteSeller = parseMoney(form.freteSeller);
  const freteCte = Math.round((freteConsumidor + freteSeller) * 100) / 100;
  const total = Math.round((subtotal - desconto + freteConsumidor) * 100) / 100;

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
        pedidoMl: gerarPedidoMlClient(),
        items: [
          {
            ...PEDIDO_ITEM_EMPTY,
            productId: products[0]?.id ?? "",
            xPed: gerarPedidoMlClient(),
          },
        ],
      });
    }
  }, [open, pedido, products]);

  const set = (key: keyof Omit<PedidoFormValues, "items">, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function setItem(index: number, key: keyof PedidoItemFormValues, value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ...PEDIDO_ITEM_EMPTY,
          productId: products[0]?.id ?? "",
          xPed: gerarPedidoMlClient(),
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setForm((current) => {
      if (current.items.length <= 1) return current;
      return { ...current, items: current.items.filter((_, i) => i !== index) };
    });
  }

  function applyExample(id: string) {
    const example = findPedidoFormExample(id);
    if (!example) return;
    setExampleId(id);
    setForm((current) => mergePedidoBuyerExample(current, example.values));
  }

  function submit(saveOnly: boolean) {
    setError(null);
    if (freteConsumidor <= 0 && freteSeller <= 0) {
      setError("Informe frete consumidor e/ou frete seller — ao menos um deve ser maior que zero");
      return;
    }

    const fd = new FormData();
    fd.set("itemCount", String(form.items.length));
    form.items.forEach((item, index) => {
      fd.set(`items[${index}].productId`, item.productId);
      fd.set(`items[${index}].quantidade`, item.quantidade);
      fd.set(`items[${index}].desconto`, item.desconto);
      fd.set(`items[${index}].xPed`, item.xPed);
    });
    fd.set("pedidoMl", form.pedidoMl);
    fd.set("freteConsumidor", form.freteConsumidor);
    fd.set("freteSeller", form.freteSeller);
    fd.set("cpf", form.cpf);
    fd.set("nome", form.nome);
    fd.set("logradouro", form.logradouro);
    fd.set("numero", form.numero);
    fd.set("complemento", form.complemento);
    fd.set("bairro", form.bairro);
    fd.set("codigoMunicipio", form.codigoMunicipio);
    fd.set("municipio", form.municipio);
    fd.set("uf", form.uf);
    fd.set("cep", form.cep);
    fd.set("telefone", form.telefone);
    fd.set("indIEDest", form.indIEDest);
    fd.set("ie", form.ie);
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
    setItem,
    addItem,
    removeItem,
    error,
    cepLoading,
    exampleId,
    setExampleId,
    pending,
    selectedExample,
    isEdit,
    lineTotals,
    subtotal,
    desconto,
    freteConsumidor,
    freteSeller,
    freteCte,
    total,
    applyExample,
    submit,
    onLookupCep,
  };
}

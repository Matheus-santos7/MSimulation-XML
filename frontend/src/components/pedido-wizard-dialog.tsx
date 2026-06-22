"use client";

import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PedidoDto, ProductDto } from "@/lib/fiscal-types";
import { brl } from "@/lib/format";
import {
  PEDIDO_FORM_EXAMPLE_GROUPS,
  PEDIDO_FORM_EXAMPLES,
} from "@/lib/pedido-form";
import { BRAZILIAN_UFS } from "@/lib/brazilian-states";
import { PEDIDO_WIZARD_STEPS, usePedidoWizard } from "@/hooks/use-pedido-wizard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductDto[];
  pedido?: PedidoDto;
};

export function PedidoWizardDialog({ open, onOpenChange, products, pedido }: Props) {
  const {
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
  } = usePedidoWizard({ open, onOpenChange, products, pedido });

  if (products.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle>{isEdit ? "Editar pedido" : "Novo pedido ML"}</DialogTitle>
          <DialogDescription>
            {isEdit && pedido?.editavel === false
              ? "Este pedido já foi faturado e não pode ser alterado."
              : "Simulação — rascunho editável até faturar (emite NF-e com numeração sequencial)."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-border shrink-0">
          <div className="flex gap-1">
            {PEDIDO_WIZARD_STEPS.map((label, i) => (
              <div
                key={label}
                className={`flex-1 text-center text-[11px] font-bold uppercase tracking-wider py-1.5 rounded ${
                  i === step ? "bg-accent/15 text-accent" : i < step ? "text-muted-foreground" : "text-muted-foreground/50"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Produto</Label>
                <select
                  value={form.productId}
                  onChange={(e) => set("productId", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.quantidade}
                    onChange={(e) => set("quantidade", e.target.value)}
                  />
                </div>
                <div className="flex items-end text-[14px]">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="ml-1 font-mono font-bold text-accent">{brl(total)}</span>
                </div>
              </div>
              {!isEdit ? (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <Label htmlFor="pedidoExample">Exemplo de comprador (simulação fiscal)</Label>
                  <select
                    id="pedidoExample"
                    value={exampleId}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) applyExample(id);
                      else setExampleId("");
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">Selecione um exemplo…</option>
                    {PEDIDO_FORM_EXAMPLE_GROUPS.map((group) => (
                      <optgroup key={group.kind} label={group.label}>
                        {PEDIDO_FORM_EXAMPLES.filter((item) => item.kind === group.kind).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {selectedExample ? (
                    <p className="text-[12px] text-muted-foreground">{selectedExample.fiscalHint}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-3">
              <Field
                label="CPF / CNPJ"
                value={form.cpf}
                onChange={(v) => set("cpf", v)}
                mono
              />
              <Field label="Nome (xNome)" value={form.nome} onChange={(v) => set("nome", v)} />
              <Field label="Telefone" value={form.telefone} onChange={(v) => set("telefone", v)} mono />
              <div className="space-y-2">
                <Label htmlFor="indIEDest">Indicador IE destinatário (indIEDest)</Label>
                <select
                  id="indIEDest"
                  name="indIEDest"
                  value={form.indIEDest}
                  onChange={(e) => set("indIEDest", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="9">9 — Não contribuinte (consumidor final)</option>
                  <option value="1">1 — Contribuinte ICMS</option>
                  <option value="2">2 — Contribuinte isento de IE</option>
                </select>
                <p className="text-[12px] text-muted-foreground">
                  Define a regra tributária (taxpayer / non_taxpayer) e validações SEFAZ na emissão da NF-e.
                </p>
              </div>
              {form.indIEDest === "1" && (
                <Field
                  label="Inscrição Estadual (IE)"
                  value={form.ie}
                  onChange={(v) => set("ie", v)}
                  mono
                />
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} className="font-mono" />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={onLookupCep} disabled={cepLoading}>
                  {cepLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
              </div>
              <Field label="Logradouro" value={form.logradouro} onChange={(v) => set("logradouro", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Número" value={form.numero} onChange={(v) => set("numero", v)} />
                <Field label="Complemento" value={form.complemento} onChange={(v) => set("complemento", v)} />
              </div>
              <Field label="Bairro" value={form.bairro} onChange={(v) => set("bairro", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Município" value={form.municipio} onChange={(v) => set("municipio", v)} />
                <Field label="Cód. IBGE" value={form.codigoMunicipio} onChange={(v) => set("codigoMunicipio", v)} mono />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <select
                  value={form.uf}
                  onChange={(e) => set("uf", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {BRAZILIAN_UFS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-[14px]">
              <ReviewRow label="Produto" value={selected ? `${selected.sku} — ${selected.nome}` : "—"} />
              <ReviewRow label="Qtd / Total" value={`${qty} × ${brl(selected?.preco ?? 0)} = ${brl(total)}`} />
              <ReviewRow label="Comprador" value={`${form.nome} (${form.cpf})`} />
              <ReviewRow label="Perfil fiscal" value={formatIndIEDest(form.indIEDest, form.cpf, form.ie)} />
              <ReviewRow
                label="Entrega"
                value={`${form.logradouro}, ${form.numero}${form.complemento ? ` — ${form.complemento}` : ""} — ${form.bairro}, ${form.municipio}/${form.uf} — CEP ${form.cep}`}
              />
              <p className="text-[12px] text-muted-foreground pt-2">
                Ao faturar, a NF-e recebe o próximo número da série desta empresa. Pedidos faturados não podem ser editados.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex flex-wrap gap-2 justify-between shrink-0 bg-card">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={step === 0 || pending} onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="size-4 mr-1" />
              Voltar
            </Button>
            {step < 3 && (
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setStep((s) => s + 1)}>
                Próximo
                <ChevronRight className="size-4 ml-1" />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 0 && !isEdit && exampleId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => applyExample(exampleId)}>
                Recarregar exemplo
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => submit(true)}>
              Salvar rascunho
            </Button>
            {step === 3 && (
              <Button type="button" size="sm" disabled={pending} onClick={() => submit(false)}>
                {pending ? "Faturando…" : "Faturar NF-e"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className={mono ? "font-mono" : undefined} />
    </div>
  );
}

function formatIndIEDest(indIEDest: string, doc: string, ie?: string): string {
  const digits = doc.replace(/\D/g, "");
  const docLabel = digits.length === 14 ? "CNPJ" : "CPF";
  const profile =
    indIEDest === "1"
      ? "Contribuinte ICMS"
      : indIEDest === "2"
        ? "Contribuinte isento"
        : "Não contribuinte";
  const ieSuffix = indIEDest === "1" && ie?.trim() ? ` · IE ${ie.replace(/\D/g, "")}` : "";
  return `${docLabel} · indIEDest ${indIEDest} (${profile})${ieSuffix}`;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

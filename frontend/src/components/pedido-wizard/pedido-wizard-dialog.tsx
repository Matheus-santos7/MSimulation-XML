"use client";

import { ChevronLeft, ChevronRight, Loader2, MapPin, Package, Plus, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PedidoDto, ProductDto } from "@/lib/fiscal-types";
import { brl } from "@/lib/format";
import { BRAZILIAN_UFS } from "@/lib/brazilian-states";
import { PEDIDO_WIZARD_LAST_STEP, PEDIDO_WIZARD_STEPS, usePedidoWizard } from "@/hooks/use-pedido-wizard";
import {
  WizardField,
  WizardReviewCard,
  WizardReviewOrderItem,
  WizardReviewRow,
  WizardReviewSummary,
  WizardSection,
  WizardSelect,
} from "./pedido-wizard-form-fields";
import { PedidoWizardFreightPanel } from "./pedido-wizard-freight-panel";
import { PedidoWizardItemsTable } from "./pedido-wizard-items-table";
import { PedidoWizardStepper } from "./pedido-wizard-stepper";
import { PedidoWizardBuyerExamplePanel } from "./pedido-wizard-summary";
import {
  PEDIDO_WIZARD_BODY_CLASS,
  PEDIDO_WIZARD_FOOTER_CLASS,
  PEDIDO_WIZARD_HEADER_CLASS,
  PEDIDO_WIZARD_MODAL_CLASS,
  PEDIDO_WIZARD_OVERLAY_CLASS,
  PEDIDO_WIZARD_PANEL_CLASS,
} from "./pedido-wizard-styles";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductDto[];
  pedido?: PedidoDto;
};

const STEP_HINTS = [
  "Produtos, quantidades e descontos do pedido.",
  "Frete NF-e na nota e frete CT-e no transporte — valores únicos por pedido.",
  "Selecione um comprador de exemplo ou preencha os dados manualmente.",
  "Endereço de entrega do pedido.",
  "Confira tudo antes de faturar.",
] as const;

export function PedidoWizardDialog({ open, onOpenChange, products, pedido }: Props) {
  const {
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
    freteConsumidor,
    freteSeller,
    total,
    applyExample,
    submit,
    onLookupCep,
  } = usePedidoWizard({ open, onOpenChange, products, pedido });

  if (products.length === 0) return null;

  const locked = isEdit && pedido?.editavel === false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={PEDIDO_WIZARD_MODAL_CLASS} overlayClassName={PEDIDO_WIZARD_OVERLAY_CLASS}>
        <DialogHeader className={PEDIDO_WIZARD_HEADER_CLASS}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pr-8">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
                Etapa {step + 1} de {PEDIDO_WIZARD_STEPS.length}
              </p>
              <DialogTitle className="mt-1 text-lg sm:text-xl">
                {isEdit ? "Editar pedido" : "Novo pedido ML"}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[13px] leading-snug max-w-2xl">
                {locked
                  ? "Este pedido já foi faturado e não pode ser alterado."
                  : STEP_HINTS[step]}
              </DialogDescription>
            </div>
            <div className={`${PEDIDO_WIZARD_PANEL_CLASS} shrink-0 px-4 py-2.5 sm:min-w-[9.5rem]`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="font-mono text-xl font-bold text-accent tabular-nums">{brl(total)}</p>
            </div>
          </div>
        </DialogHeader>

        <PedidoWizardStepper steps={PEDIDO_WIZARD_STEPS} currentStep={step} />

        <div className={PEDIDO_WIZARD_BODY_CLASS}>
          {error ? (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
              {error}
            </div>
          ) : null}

          {step === 0 && (
            <div className="space-y-4">
              <div className={`${PEDIDO_WIZARD_PANEL_CLASS} p-4 space-y-1.5`}>
                <Label className="text-[12px] text-muted-foreground">PackId (pedido ML)</Label>
                <Input
                  value={form.pedidoMl}
                  onChange={(e) => set("pedidoMl", e.target.value)}
                  className="h-9 bg-background font-mono text-[12px]"
                  placeholder="Gerado automaticamente"
                  disabled={locked}
                />
              </div>
              <WizardSection
                title={`Itens do pedido (${form.items.length})`}
                action={
                  <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={locked}>
                    <Plus className="size-3.5 mr-1" />
                    Adicionar item
                  </Button>
                }
              >
                <PedidoWizardItemsTable
                  items={form.items}
                  products={products}
                  lineTotals={lineTotals}
                  onItemChange={setItem}
                  onRemoveItem={removeItem}
                />
              </WizardSection>
            </div>
          )}

          {step === 1 && (
            <div className={`${PEDIDO_WIZARD_PANEL_CLASS} p-5`}>
              <WizardSection
                title="Frete do pedido"
                description="Informe ao menos um frete maior que zero."
              >
                <PedidoWizardFreightPanel
                  freteConsumidor={form.freteConsumidor}
                  freteSeller={form.freteSeller}
                  onChange={(key, value) => set(key, value)}
                />
              </WizardSection>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
              {!isEdit ? (
                <PedidoWizardBuyerExamplePanel
                  exampleId={exampleId}
                  selectedExample={selectedExample}
                  onExampleChange={(id) => {
                    if (id) applyExample(id);
                    else setExampleId("");
                  }}
                  onReloadExample={exampleId ? () => applyExample(exampleId) : undefined}
                />
              ) : null}

              <div className={`${PEDIDO_WIZARD_PANEL_CLASS} p-5 ${isEdit ? "lg:col-span-2" : ""}`}>
                <WizardSection title="Dados do comprador" description="Destinatário da NF-e de venda.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <WizardField label="CPF / CNPJ" value={form.cpf} onChange={(v) => set("cpf", v)} mono />
                  <WizardField label="Telefone" value={form.telefone} onChange={(v) => set("telefone", v)} mono />
                  <div className="sm:col-span-2">
                    <WizardField label="Nome (xNome)" value={form.nome} onChange={(v) => set("nome", v)} />
                  </div>
                  <div className="sm:col-span-2">
                    <WizardSelect
                      id="indIEDest"
                      label="Indicador IE (indIEDest)"
                      value={form.indIEDest}
                      onChange={(v) => set("indIEDest", v)}
                      hint="Define regra tributária e validações SEFAZ."
                    >
                      <option value="9">9 — Não contribuinte (consumidor final)</option>
                      <option value="1">1 — Contribuinte ICMS</option>
                      <option value="2">2 — Contribuinte isento de IE</option>
                    </WizardSelect>
                  </div>
                  {form.indIEDest === "1" && (
                    <div className="sm:col-span-2">
                      <WizardField
                        label="Inscrição Estadual (IE)"
                        value={form.ie}
                        onChange={(v) => set("ie", v)}
                        mono
                      />
                    </div>
                  )}
                </div>
                </WizardSection>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={`${PEDIDO_WIZARD_PANEL_CLASS} p-5`}>
              <WizardSection title="Endereço de entrega">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex gap-2 items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-[12px] text-muted-foreground">CEP</Label>
                      <Input
                        value={form.cep}
                        onChange={(e) => set("cep", e.target.value)}
                        className="font-mono bg-background"
                      />
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={onLookupCep} disabled={cepLoading}>
                      {cepLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    </Button>
                  </div>
                  <div className="sm:col-span-2">
                    <WizardField label="Logradouro" value={form.logradouro} onChange={(v) => set("logradouro", v)} />
                  </div>
                  <WizardField label="Número" value={form.numero} onChange={(v) => set("numero", v)} />
                  <WizardField label="Complemento" value={form.complemento} onChange={(v) => set("complemento", v)} />
                  <WizardField label="Bairro" value={form.bairro} onChange={(v) => set("bairro", v)} />
                  <WizardField label="Município" value={form.municipio} onChange={(v) => set("municipio", v)} />
                  <WizardField
                    label="Cód. IBGE"
                    value={form.codigoMunicipio}
                    onChange={(v) => set("codigoMunicipio", v)}
                    mono
                  />
                  <WizardSelect label="UF" value={form.uf} onChange={(v) => set("uf", v)}>
                    {BRAZILIAN_UFS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </WizardSelect>
                </div>
              </WizardSection>
            </div>
          )}

          {step === PEDIDO_WIZARD_LAST_STEP && (
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
              <WizardReviewCard title="Itens" icon={<Package aria-hidden />}>
                <div className="space-y-2">
                  {form.items.map((item, index) => {
                    const line = lineTotals[index];
                    return (
                      <WizardReviewOrderItem
                        key={index}
                        index={index + 1}
                        sku={line?.product?.sku ?? "—"}
                        name={line?.product?.nome ?? "—"}
                        qty={line?.qty ?? 1}
                        unitPrice={line?.product?.preco ?? 0}
                        discount={line?.desconto ?? 0}
                        lineTotal={line?.total ?? 0}
                      />
                    );
                  })}
                </div>
                {(freteConsumidor > 0 || freteSeller > 0) && (
                  <WizardReviewSummary>
                    {freteConsumidor > 0 && (
                      <WizardReviewRow label="Frete NF-e" value={brl(freteConsumidor)} mono />
                    )}
                    {freteSeller > 0 && (
                      <WizardReviewRow label="Frete CT-e" value={brl(freteSeller)} mono />
                    )}
                  </WizardReviewSummary>
                )}
              </WizardReviewCard>

              <WizardReviewCard title="Comprador" icon={<User aria-hidden />}>
                <WizardReviewRow label="Nome" value={form.nome || "—"} />
                <WizardReviewRow label="Documento" value={form.cpf || "—"} mono />
                <WizardReviewRow
                  label="Perfil fiscal"
                  value={formatIndIEDest(form.indIEDest, form.cpf, form.ie)}
                />
              </WizardReviewCard>

              <WizardReviewCard title="Entrega" icon={<MapPin aria-hidden />}>
                <WizardReviewRow
                  label="Endereço"
                  value={`${form.logradouro}, ${form.numero}${form.complemento ? ` — ${form.complemento}` : ""}`}
                />
                <WizardReviewRow label="Bairro / Cidade" value={`${form.bairro} — ${form.municipio}/${form.uf}`} />
                <WizardReviewRow label="CEP" value={form.cep || "—"} mono />
              </WizardReviewCard>
            </div>
          )}
        </div>

        <footer className={PEDIDO_WIZARD_FOOTER_CLASS}>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={step === 0 || pending}
              onClick={() => setStep((s) => s - 1)}
            >
              <ChevronLeft className="size-4 mr-1" />
              Voltar
            </Button>
            {step < PEDIDO_WIZARD_LAST_STEP && (
              <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => setStep((s) => s + 1)}>
                Próximo
                <ChevronRight className="size-4 ml-1" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" size="sm" disabled={pending || locked} onClick={() => submit(true)}>
              Salvar rascunho
            </Button>
            {step === PEDIDO_WIZARD_LAST_STEP && (
              <Button type="button" size="sm" disabled={pending || locked} onClick={() => submit(false)}>
                {pending ? "Faturando…" : "Faturar NF-e"}
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
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

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProdutoFormValues } from "@/lib/produto-form";
import { EX_TIPI_FIELD_HELP } from "@/lib/produto-planilha";
import type { ProductDto, TaxRuleCatalogEntry } from "@/lib/fiscal-types";

const ORIGEM_OPTIONS = [
  { value: "0", label: "0 — Nacional" },
  { value: "1", label: "1 — Estrangeira (importação direta)" },
  { value: "2", label: "2 — Estrangeira (mercado interno)" },
  { value: "3", label: "3 — Nacional (>40% conteúdo importado)" },
  { value: "4", label: "4 — Nacional (PPB básica)" },
  { value: "5", label: "5 — Nacional (<40% conteúdo importado)" },
  { value: "6", label: "6 — Estrangeira (importação direta, sem similar)" },
  { value: "7", label: "7 — Estrangeira (mercado interno, sem similar)" },
  { value: "8", label: "8 — Nacional (>70% conteúdo importado)" },
] as const;

const UNIDADE_OPTIONS = ["UN", "UNID", "PC", "CX", "KG", "M", "M2", "M3", "PR", "PAR"] as const;

type Props = {
  product?: ProductDto;
  draft?: ProdutoFormValues;
  fieldErrors?: Record<string, string[]>;
  idPrefix?: string;
  taxRuleCatalog?: TaxRuleCatalogEntry[];
};

function toFormState(product?: ProductDto, draft?: ProdutoFormValues): ProdutoFormValues {
  if (draft) return draft;
  return {
    sku: product?.sku ?? "",
    ean: product?.ean ?? "",
    nome: product?.nome ?? "",
    ncm: product?.ncm ?? "",
    cest: product?.cest ?? "",
    exTipi: product?.exTipi ?? "",
    origem: String(product?.origem ?? 0),
    unidade: product?.unidade ?? "UN",
    preco: product != null ? String(product.preco) : "",
    precoCusto: product != null ? String(product.precoCusto) : "",
    estoque: product != null ? String(product.estoque) : "1",
    taxRuleBaseId: product?.taxRuleBaseId ?? "",
  };
}

export function ProductFormFields({
  product,
  draft,
  fieldErrors,
  idPrefix = "prod",
  taxRuleCatalog = [],
}: Props) {
  const [form, setForm] = useState<ProdutoFormValues>(() => toFormState(product, draft));

  useEffect(() => {
    if (draft) {
      setForm(draft);
      return;
    }
    if (product) setForm(toFormState(product));
  }, [product?.id, draft]);

  const set = (key: keyof ProdutoFormValues, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const err = (name: keyof ProdutoFormValues) => fieldErrors?.[name]?.[0];

  return (
    <div className="space-y-6">
      <Section title="Identificação (prod)">
        <Field id={`${idPrefix}-sku`} label="Código (cProd)" name="sku" value={form.sku} onChange={set} required mono error={err("sku")} />
        <Field
          id={`${idPrefix}-ean`}
          label="EAN/GTIN (cEAN)"
          name="ean"
          value={form.ean}
          onChange={set}
          mono
          error={err("ean")}
          hint="Deixe vazio para SEM GTIN no XML"
        />
        <Field id={`${idPrefix}-nome`} label="Descrição (xProd)" name="nome" value={form.nome} onChange={set} required error={err("nome")} />
      </Section>

      <Section title="Classificação fiscal">
        <SelectField
          id={`${idPrefix}-taxRuleBaseId`}
          label="Regra tributária (planilha)"
          name="taxRuleBaseId"
          value={form.taxRuleBaseId}
          onChange={set}
          required
          options={
            taxRuleCatalog.length > 0
              ? taxRuleCatalog.map((r) => ({ value: r.baseId, label: r.label }))
              : [{ value: "", label: "Importe regras em Regras tributárias" }]
          }
          error={err("taxRuleBaseId")}
          hint="No faturamento, cruzamos origem da empresa × UF do destinatário nesta regra."
        />
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${idPrefix}-ncm`} label="NCM" name="ncm" value={form.ncm} onChange={set} required mono error={err("ncm")} />
          <Field id={`${idPrefix}-cest`} label="CEST" name="cest" value={form.cest} onChange={set} required mono error={err("cest")} />
        </div>
        <Field
          id={`${idPrefix}-exTipi`}
          label="EXTIPI"
          name="exTipi"
          value={form.exTipi}
          onChange={set}
          mono
          error={err("exTipi")}
          labelHelp={EX_TIPI_FIELD_HELP}
        />
        <SelectField
          id={`${idPrefix}-origem`}
          label="Origem (ICMS)"
          name="origem"
          value={form.origem}
          onChange={set}
          options={ORIGEM_OPTIONS}
          error={err("origem")}
        />
      </Section>

      <Section title="Comercial">
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            id={`${idPrefix}-unidade`}
            label="Unidade"
            name="unidade"
            value={form.unidade}
            onChange={set}
            options={UNIDADE_OPTIONS.map((u) => ({ value: u, label: u }))}
            error={err("unidade")}
          />
          <Field
            id={`${idPrefix}-precoCusto`}
            label="Preço de custo"
            name="precoCusto"
            value={form.precoCusto}
            onChange={set}
            required
            mono
            type="number"
            step="0.00000001"
            min="0"
            error={err("precoCusto")}
            hint="Usado na NF-e de remessa (vUnCom)."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            id={`${idPrefix}-preco`}
            label="Preço de venda"
            name="preco"
            value={form.preco}
            onChange={set}
            required
            mono
            type="number"
            step="0.00000001"
            min="0"
            error={err("preco")}
            hint="Usado na NF-e de venda ao cliente."
          />
          <Field
            id={`${idPrefix}-estoque`}
            label="Quantidade"
            name="estoque"
            value={form.estoque}
            onChange={set}
            required
            mono
            type="number"
            step="1"
            min="0"
            error={err("estoque")}
            hint={
              product
                ? "Saldo cadastral do produto. A remessa é emitida no módulo de remessas."
                : "Saldo inicial do produto. A remessa é emitida no módulo de remessas."
            }
          />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldLabelHelp({ text, id }: { text: string; id: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold leading-none text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          aria-label="Ajuda sobre o campo"
          aria-describedby={id}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent id={id} align="start" className="w-72 text-sm leading-relaxed">
        {text}
      </PopoverContent>
    </Popover>
  );
}

function Field({
  id,
  label,
  name,
  value,
  onChange,
  required,
  mono,
  error,
  hint,
  labelHelp,
  type = "text",
  step,
  min,
}: {
  id: string;
  label: string;
  name: keyof ProdutoFormValues;
  value: string;
  onChange: (key: keyof ProdutoFormValues, value: string) => void;
  required?: boolean;
  mono?: boolean;
  error?: string;
  hint?: string;
  labelHelp?: string;
  type?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {labelHelp ? <FieldLabelHelp text={labelHelp} id={`${id}-help`} /> : null}
      </div>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        type={type}
        step={step}
        min={min}
        className={mono ? "font-mono" : undefined}
      />
      {hint && !error && <p className="text-[12px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({
  id,
  label,
  name,
  value,
  onChange,
  options,
  error,
  hint,
  required,
}: {
  id: string;
  label: string;
  name: keyof ProdutoFormValues;
  value: string;
  onChange: (key: keyof ProdutoFormValues, value: string) => void;
  options: readonly { value: string; label: string }[];
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        value={value}
        required={required}
        onChange={(e) => onChange(name, e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {!value ? (
          <option value="" disabled className="bg-background">
            Selecione a regra…
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value} className="bg-background">
            {o.label}
          </option>
        ))}
      </select>
      {hint && !error ? <p className="text-[12px] text-muted-foreground">{hint}</p> : null}
      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}

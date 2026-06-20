"use client";

import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { TenantFilialDto } from "@/lib/fiscal-types";
import { useFilialForm } from "@/hooks/use-filial-form";

type Props = {
  unidades: UnidadeLogisticaDto[];
  filial?: TenantFilialDto;
  onCancel?: () => void;
  onSaved?: () => void;
  /** Remove borda externa quando dentro de Dialog/Sheet */
  embedded?: boolean;
};

export function FilialForm({ unidades, filial, onCancel, onSaved, embedded }: Props) {
  const {
    form,
    set,
    error,
    lookupError,
    pending,
    cnpjLoading,
    cepLoading,
    isEdit,
    fieldId,
    onLookupCnpj,
    onLookupCep,
    onSubmit,
  } = useFilialForm({ filial, onSaved });

  return (
    <form
      onSubmit={onSubmit}
      className={
        embedded
          ? "space-y-3"
          : "border border-border rounded-lg bg-card p-4 space-y-3 max-w-xl"
      }
    >
      {!embedded && (
        <p className="text-sm font-medium text-foreground">
          {isEdit ? `Editar filial — ${filial!.nomeFantasia}` : "Nova filial"}
        </p>
      )}

      {lookupError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {lookupError}
        </div>
      )}

      <div className="flex gap-2 items-end sm:col-span-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor={fieldId("cnpj")}>CNPJ</Label>
          <Input
            id={fieldId("cnpj")}
            value={form.cnpj}
            onChange={(e) => set("cnpj", e.target.value)}
            required
            placeholder="00.000.000/0001-00"
            className="font-mono"
          />
        </div>
        <Button type="button" variant="outline" onClick={onLookupCnpj} disabled={cnpjLoading} className="shrink-0">
          {cnpjLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          <span className="ml-2 hidden sm:inline">Buscar CNPJ</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Razão social"
          inputId={fieldId("razaoSocial")}
          value={form.razaoSocial}
          onChange={(v) => set("razaoSocial", v)}
          required
        />
        <Field
          label="Nome fantasia"
          inputId={fieldId("nomeFantasia")}
          value={form.nomeFantasia}
          onChange={(v) => set("nomeFantasia", v)}
          required
        />
        <Field
          label="IE"
          inputId={fieldId("ie")}
          value={form.ie}
          onChange={(v) => set("ie", v)}
          required
        />
        <Field
          label="Série remessa (filial)"
          inputId={fieldId("serieRemessa")}
          type="number"
          value={form.serieRemessa}
          onChange={(v) => set("serieRemessa", v)}
          required
        />
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor={fieldId("cep")}>CEP</Label>
          <Input
            id={fieldId("cep")}
            value={form.cep}
            onChange={(e) => set("cep", e.target.value)}
            required
            placeholder="00000-000"
            className="font-mono"
          />
        </div>
        <Button type="button" variant="outline" onClick={onLookupCep} disabled={cepLoading} className="shrink-0">
          {cepLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          <span className="ml-2 hidden sm:inline">Buscar CEP</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="UF"
          inputId={fieldId("uf")}
          value={form.uf}
          onChange={(v) => set("uf", v)}
          maxLength={2}
          required
        />
        <Field
          label="Município"
          inputId={fieldId("municipio")}
          value={form.municipio}
          onChange={(v) => set("municipio", v)}
          required
        />
        <Field
          label="Cód. IBGE"
          inputId={fieldId("codigoMunicipio")}
          value={form.codigoMunicipio}
          onChange={(v) => set("codigoMunicipio", v)}
          required
          mono
          hint="Se vazio após buscar CNPJ, clique em Buscar CEP"
        />
        <Field
          label="Logradouro"
          inputId={fieldId("logradouro")}
          value={form.logradouro}
          onChange={(v) => set("logradouro", v)}
          required
        />
        <Field
          label="Número"
          inputId={fieldId("numero")}
          value={form.numero}
          onChange={(v) => set("numero", v)}
          required
        />
        <Field
          label="Bairro"
          inputId={fieldId("bairro")}
          value={form.bairro}
          onChange={(v) => set("bairro", v)}
          required
        />
        <Field
          label="Telefone"
          inputId={fieldId("telefone")}
          value={form.telefone}
          onChange={(v) => set("telefone", v)}
        />
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">CD padrão da filial (opcional)</span>
        <select
          value={form.unidadeLogisticaPadraoId}
          onChange={(e) => set("unidadeLogisticaPadraoId", e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Usar CD padrão da matriz</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.codigo} — {u.nome} ({u.endereco.uf})
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar filial"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}

function Field({
  label,
  inputId,
  value,
  onChange,
  type = "text",
  required,
  maxLength,
  mono,
  hint,
}: {
  label: string;
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        className={mono ? "font-mono" : undefined}
      />
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </label>
  );
}

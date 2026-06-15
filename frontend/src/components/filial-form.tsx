"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFilialAction, updateFilialAction } from "@/app/(app)/empresas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { TenantFilialDto, TenantFilialInput } from "@/lib/fiscal-types";

type Props = {
  unidades: UnidadeLogisticaDto[];
  filial?: TenantFilialDto;
  onCancel?: () => void;
  onSaved?: () => void;
};

export function FilialForm({ unidades, filial, onCancel, onSaved }: Props) {
  const router = useRouter();
  const isEdit = Boolean(filial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const payload = parseFilialFormData(fd);
    try {
      const result = filial
        ? await updateFilialAction(filial.id, payload)
        : await createFilialAction(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (filial) {
        onSaved?.();
      } else {
        e.currentTarget.reset();
      }
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : isEdit ? "Erro ao atualizar filial" : "Erro ao cadastrar filial");
    } finally {
      setPending(false);
    }
  }

  const fieldId = (name: string) => (filial ? `${filial.id}-${name}` : name);

  return (
    <form onSubmit={onSubmit} className="border border-border rounded-lg bg-card p-4 space-y-3 max-w-xl">
      <p className="text-sm font-medium text-foreground">
        {isEdit ? `Editar filial — ${filial!.nomeFantasia}` : "Nova filial"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Razão social"
          name="razaoSocial"
          inputId={fieldId("razaoSocial")}
          required
          defaultValue={filial?.razaoSocial}
        />
        <Field
          label="Nome fantasia"
          name="nomeFantasia"
          inputId={fieldId("nomeFantasia")}
          required
          defaultValue={filial?.nomeFantasia}
        />
        <Field label="CNPJ" name="cnpj" inputId={fieldId("cnpj")} required defaultValue={filial?.cnpj} />
        <Field label="IE" name="ie" inputId={fieldId("ie")} required defaultValue={filial?.ie} />
        <Field
          label="Série remessa (filial)"
          name="serieRemessa"
          inputId={fieldId("serieRemessa")}
          type="number"
          defaultValue={String(filial?.serieRemessa ?? 8)}
          required
        />
        <Field
          label="UF"
          name="uf"
          inputId={fieldId("uf")}
          maxLength={2}
          required
          defaultValue={filial?.uf}
        />
        <Field
          label="Município"
          name="municipio"
          inputId={fieldId("municipio")}
          required
          defaultValue={filial?.municipio}
        />
        <Field
          label="Cód. IBGE"
          name="codigoMunicipio"
          inputId={fieldId("codigoMunicipio")}
          required
          defaultValue={filial?.codigoMunicipio}
        />
        <Field
          label="Logradouro"
          name="logradouro"
          inputId={fieldId("logradouro")}
          required
          defaultValue={filial?.logradouro}
        />
        <Field
          label="Número"
          name="numero"
          inputId={fieldId("numero")}
          defaultValue={filial?.numero ?? "SN"}
          required
        />
        <Field label="Bairro" name="bairro" inputId={fieldId("bairro")} required defaultValue={filial?.bairro} />
        <Field label="CEP" name="cep" inputId={fieldId("cep")} required defaultValue={filial?.cep} />
        <Field label="Telefone" name="telefone" inputId={fieldId("telefone")} defaultValue={filial?.telefone} />
        <input type="hidden" name="crt" value={String(filial?.crt ?? 3)} />
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">CD padrão da filial (opcional)</span>
        <select
          name="unidadeLogisticaPadraoId"
          defaultValue={filial?.unidadeLogisticaPadraoId ?? ""}
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

function parseFilialFormData(fd: FormData): TenantFilialInput {
  const serieTransferenciaRaw = String(fd.get("serieTransferencia") ?? "").trim();
  return {
    razaoSocial: String(fd.get("razaoSocial") ?? ""),
    nomeFantasia: String(fd.get("nomeFantasia") ?? ""),
    cnpj: String(fd.get("cnpj") ?? ""),
    ie: String(fd.get("ie") ?? ""),
    crt: Number(fd.get("crt") ?? 3),
    logradouro: String(fd.get("logradouro") ?? ""),
    numero: String(fd.get("numero") ?? "SN"),
    complemento: String(fd.get("complemento") ?? "") || undefined,
    bairro: String(fd.get("bairro") ?? ""),
    codigoMunicipio: String(fd.get("codigoMunicipio") ?? ""),
    municipio: String(fd.get("municipio") ?? ""),
    uf: String(fd.get("uf") ?? "").toUpperCase(),
    cep: String(fd.get("cep") ?? ""),
    telefone: String(fd.get("telefone") ?? "") || undefined,
    serieRemessa: Number(fd.get("serieRemessa") ?? 8),
    serieTransferencia: serieTransferenciaRaw ? Number(serieTransferenciaRaw) : undefined,
    unidadeLogisticaPadraoId: String(fd.get("unidadeLogisticaPadraoId") ?? "") || undefined,
  };
}

function Field({
  label,
  name,
  inputId,
  type = "text",
  required,
  defaultValue,
  maxLength,
}: {
  label: string;
  name: string;
  inputId: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-1">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        maxLength={maxLength}
      />
    </label>
  );
}

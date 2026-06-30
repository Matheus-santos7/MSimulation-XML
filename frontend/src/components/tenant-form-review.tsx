import type { EmpresaFormValues } from "@/lib/empresa-form";
import { TENANT_CRT_OPTIONS } from "@/hooks/use-tenant-form-fields";
import { cn } from "@/lib/utils";

type Props = {
  values: EmpresaFormValues;
  className?: string;
};

/**
 * Resumo somente leitura dos dados da empresa para confirmação no onboarding.
 */
export function TenantFormReview({ values, className }: Props) {
  const crtLabel =
    TENANT_CRT_OPTIONS.find((option) => option.value === values.crt)?.label ?? values.crt;

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      <ReviewSection title="Identificação">
        <ReviewItem label="CNPJ" value={values.cnpj} mono />
        <ReviewItem label="Razão social" value={values.razaoSocial} />
        <ReviewItem label="Nome fantasia" value={values.nomeFantasia} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReviewItem label="Inscrição estadual" value={values.ie} mono />
          <ReviewItem label="IE substituto" value={values.iest || "—"} mono />
        </div>
        <ReviewItem label="Regime tributário" value={crtLabel} />
      </ReviewSection>

      <ReviewSection title="Endereço">
        <ReviewItem label="CEP" value={values.cep} mono />
        <ReviewItem label="Logradouro" value={values.logradouro} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReviewItem label="Número" value={values.numero} />
          <ReviewItem label="Complemento" value={values.complemento || "—"} />
        </div>
        <ReviewItem label="Bairro" value={values.bairro} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReviewItem label="Município" value={values.municipio} />
          <ReviewItem label="Cód. IBGE" value={values.codigoMunicipio} mono />
        </div>
        <ReviewItem label="UF" value={values.uf} />
      </ReviewSection>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full rounded-lg border border-border/60 bg-muted/15 p-4 sm:p-5">
      <h3 className="mb-4 border-b border-border/60 pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground sm:text-[12px]">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ReviewItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-[14px] text-foreground break-words", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

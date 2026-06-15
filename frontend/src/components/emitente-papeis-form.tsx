"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePapeisFiscaisAction } from "@/app/(app)/empresas/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TenantDto, TenantFilialDto } from "@/lib/fiscal-types";

const MATRIZ_VALUE = "__matriz__";

type EstabelecimentoOption = {
  id: string;
  label: string;
};

function buildEstabelecimentos(tenant: TenantDto, filiais: TenantFilialDto[]): EstabelecimentoOption[] {
  const matriz: EstabelecimentoOption = {
    id: MATRIZ_VALUE,
    label: `Matriz — ${tenant.nomeFantasia} (${tenant.cnpj})`,
  };
  const filialOptions = filiais.map((f) => ({
    id: f.id,
    label: `Filial — ${f.nomeFantasia} (${f.cnpj})`,
  }));
  return [matriz, ...filialOptions];
}

function toSelectValue(emitenteId: string | null | undefined, tenantId: string): string {
  if (!emitenteId || emitenteId === tenantId) return MATRIZ_VALUE;
  return emitenteId;
}

function toEmitenteId(value: string, tenantId: string): string | null {
  if (value === MATRIZ_VALUE) return null;
  return value;
}

type Props = {
  tenant: TenantDto;
  filiais: TenantFilialDto[];
};

export function EmitentePapeisForm({ tenant, filiais }: Props) {
  const router = useRouter();
  const estabelecimentos = buildEstabelecimentos(tenant, filiais);

  const [remessa, setRemessa] = useState(() =>
    toSelectValue(tenant.emitenteRemessaId, tenant.id),
  );
  const [transferencia, setTransferencia] = useState(() =>
    toSelectValue(tenant.emitenteTransferenciaId, tenant.id),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setPending(true);
    setError(null);
    setOk(false);
    const result = await updatePapeisFiscaisAction({
      emitenteRemessaId: toEmitenteId(remessa, tenant.id),
      emitenteTransferenciaId: toEmitenteId(transferencia, tenant.id),
    });
    if (result.error) {
      setError(result.error);
    } else {
      setOk(true);
      router.refresh();
    }
    setPending(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Defina qual estabelecimento (matriz ou filial) emite remessas para o fulfillment e qual
          emite transferências de estoque entre filiais.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emitente-remessa">Quem emite remessas para o Fulfillment?</Label>
          <Select value={remessa} onValueChange={setRemessa}>
            <SelectTrigger id="emitente-remessa" className="w-full">
              <SelectValue placeholder="Selecione o emitente" />
            </SelectTrigger>
            <SelectContent>
              {estabelecimentos.map((e) => (
                <SelectItem key={`remessa-${e.id}`} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emitente-transferencia">Quem emite transferências de estoque?</Label>
          <Select value={transferencia} onValueChange={setTransferencia}>
            <SelectTrigger id="emitente-transferencia" className="w-full">
              <SelectValue placeholder="Selecione o emitente" />
            </SelectTrigger>
            <SelectContent>
              {estabelecimentos.map((e) => (
                <SelectItem key={`transferencia-${e.id}`} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="button" onClick={salvar} disabled={pending}>
        {pending ? "Salvando…" : "Salvar papéis fiscais"}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {ok && <p className="text-sm text-success">Papéis fiscais atualizados.</p>}
    </div>
  );
}

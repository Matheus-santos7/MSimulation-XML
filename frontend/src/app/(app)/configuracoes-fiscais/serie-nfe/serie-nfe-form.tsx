"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { FiscalSettingsFormShell } from "@/components/fiscal-settings-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { NfeNumeracaoView } from "@/lib/fiscal-emitter-settings-types";
import { useNfeNumeracaoPreview } from "./use-nfe-numeracao-preview";

type Props = {
  serieRemessa: number;
  serieTransferencia: number;
  serieCte: number;
  numeracaoRemessa: NfeNumeracaoView;
  numeracaoTransferencia: NfeNumeracaoView;
};

type SerieNumeracaoSectionProps = {
  prefix: string;
  serieLabel: string;
  serieDescription: string;
  serie: string;
  onSerieChange: (value: string) => void;
  numeracao: NfeNumeracaoView;
  numeroInicial: string;
  onNumeroInicialChange: (value: string) => void;
  loading: boolean;
  error: string | null;
};

/**
 * Bloco unificado de série + numeração com consulta automática ao alterar a série.
 */
function SerieNumeracaoSection({
  prefix,
  serieLabel,
  serieDescription,
  serie,
  onSerieChange,
  numeracao,
  numeroInicial,
  onNumeroInicialChange,
  loading,
  error,
}: SerieNumeracaoSectionProps) {
  return (
    <div className="relative space-y-4 rounded-lg border border-border/60 p-4">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Consultando numeração…
          </div>
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{serieLabel}</p>
        <p className="text-[12px] text-muted-foreground">{serieDescription}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}Serie`}>Série</Label>
        <Input
          id={`${prefix}Serie`}
          name={prefix === "remessa" ? "serieRemessa" : "serieTransferencia"}
          type="number"
          min={1}
          max={999}
          value={serie}
          onChange={(e) => onSerieChange(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}NumeroInicial`}>Numeração inicial</Label>
        <Input
          id={`${prefix}NumeroInicial`}
          name={`${prefix}NumeroInicial`}
          type="number"
          min={1}
          max={999999999}
          value={numeroInicial}
          onChange={(e) => onNumeroInicialChange(e.target.value)}
          disabled={loading}
        />
        <p className="text-[12px] text-muted-foreground">
          Próxima NF-e usará o maior valor entre esta numeração e a sequência após a última emitida.
        </p>
      </div>
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Última emitida</p>
          <p className="font-mono text-sm text-foreground">
            {numeracao.ultimoEmitido != null ? numeracao.ultimoEmitido : "—"}
          </p>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Próximo número</p>
          <p className="font-mono text-sm text-foreground">{numeracao.proximoNumero}</p>
        </div>
      </div>
    </div>
  );
}

export function SerieNfeForm({
  serieRemessa: initialSerieRemessa,
  serieTransferencia: initialSerieTransferencia,
  serieCte: initialSerieCte,
  numeracaoRemessa: initialNumeracaoRemessa,
  numeracaoTransferencia: initialNumeracaoTransferencia,
}: Props) {
  const [serieRemessa, setSerieRemessa] = useState(String(initialSerieRemessa));
  const [serieTransferencia, setSerieTransferencia] = useState(String(initialSerieTransferencia));
  const [serieCte, setSerieCte] = useState(String(initialSerieCte));
  const [numeroInicialRemessa, setNumeroInicialRemessa] = useState(String(initialNumeracaoRemessa.numeroInicial));
  const [numeroInicialTransferencia, setNumeroInicialTransferencia] = useState(
    String(initialNumeracaoTransferencia.numeroInicial),
  );

  const remessaPreview = useNfeNumeracaoPreview(serieRemessa, numeroInicialRemessa, initialNumeracaoRemessa);
  const transferenciaPreview = useNfeNumeracaoPreview(
    serieTransferencia,
    numeroInicialTransferencia,
    initialNumeracaoTransferencia,
  );

  return (
    <FiscalSettingsFormShell
      title="Série da NF-e"
      revalidatePaths={["/configuracoes-fiscais/serie-nfe"]}
      onSave={() => ({
        serieRemessa: Number(serieRemessa),
        serieTransferencia: Number(serieTransferencia),
        serieCte: Number(serieCte),
        nfe: {
          numeracao: {
            remessa: { numeroInicial: Number(numeroInicialRemessa) },
            transferencia: { numeroInicial: Number(numeroInicialTransferencia) },
          },
        },
      })}
    >
      <p className="text-[13px] text-muted-foreground">
        Ao alterar a série, a numeração é consultada automaticamente no banco. A série de remessa cobre remessa,
        retorno simbólico, venda e devolução; a de transferência cobre NF-e matriz → filial.
      </p>
      <SerieNumeracaoSection
        prefix="remessa"
        serieLabel="Série da NF-e (remessa / venda)"
        serieDescription="Usada em remessa, retorno simbólico, venda e devolução."
        serie={serieRemessa}
        onSerieChange={setSerieRemessa}
        numeracao={remessaPreview.numeracao}
        numeroInicial={numeroInicialRemessa}
        onNumeroInicialChange={setNumeroInicialRemessa}
        loading={remessaPreview.loading}
        error={remessaPreview.error}
      />
      <SerieNumeracaoSection
        prefix="transferencia"
        serieLabel="Série transferência filial (matriz)"
        serieDescription="Usada na NF-e de transferência entre matriz e filial."
        serie={serieTransferencia}
        onSerieChange={setSerieTransferencia}
        numeracao={transferenciaPreview.numeracao}
        numeroInicial={numeroInicialTransferencia}
        onNumeroInicialChange={setNumeroInicialTransferencia}
        loading={transferenciaPreview.loading}
        error={transferenciaPreview.error}
      />
      <div className="space-y-2">
        <Label htmlFor="serieCte">Série CT-e</Label>
        <Input
          id="serieCte"
          name="serieCte"
          type="number"
          min={1}
          max={999}
          value={serieCte}
          onChange={(e) => setSerieCte(e.target.value)}
        />
      </div>
    </FiscalSettingsFormShell>
  );
}

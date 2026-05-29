"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inutilizarNumeracaoAction } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  seriePadrao: number;
};

export function NfeInutilizarForm({ seriePadrao }: Props) {
  const router = useRouter();
  const [serie, setSerie] = useState(String(seriePadrao));
  const [numeroIni, setNumeroIni] = useState("");
  const [numeroFim, setNumeroFim] = useState("");
  const [xJust, setXJust] = useState("Numero nao utilizado dentro do prazo legal");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="border border-border rounded-lg bg-card p-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await inutilizarNumeracaoAction({
            serie: Number(serie),
            numeroIni: Number(numeroIni),
            numeroFim: Number(numeroFim),
            xJust,
          });
          if (result.error) {
            setError(result.error);
            return;
          }
          setNumeroIni("");
          setNumeroFim("");
          router.refresh();
        });
      }}
    >
      <div>
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
          Inutilizar numeração
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Registra procInutNFe para faixa não utilizada (sem NF-e emitida na série).
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inut-serie">Série</Label>
          <Input
            id="inut-serie"
            type="number"
            min={1}
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inut-ini">Nº inicial</Label>
          <Input
            id="inut-ini"
            type="number"
            min={1}
            value={numeroIni}
            onChange={(e) => setNumeroIni(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inut-fim">Nº final</Label>
          <Input
            id="inut-fim"
            type="number"
            min={1}
            value={numeroFim}
            onChange={(e) => setNumeroFim(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inut-just">Justificativa (mín. 15 caracteres)</Label>
        <Input id="inut-just" value={xJust} onChange={(e) => setXJust(e.target.value)} minLength={15} required />
      </div>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "Registrando…" : "Inutilizar faixa"}
      </Button>
    </form>
  );
}

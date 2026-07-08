import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  freteConsumidor: string;
  freteSeller: string;
  onChange: (key: "freteConsumidor" | "freteSeller", value: string) => void;
};

const MONEY_INPUT = "h-9 bg-background font-mono text-[13px] tabular-nums";

/**
 * Campos de frete do pedido (NF-e consumidor + CT-e seller).
 */
export function PedidoWizardFreightPanel({ freteConsumidor, freteSeller, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-xl">
      <div className="space-y-1.5">
        <Label className="text-[12px] text-muted-foreground">Frete NF-e</Label>
        <Input
          type="number"
          min={0}
          step={0.01}
          inputMode="decimal"
          value={freteConsumidor}
          onChange={(e) => onChange("freteConsumidor", e.target.value)}
          className={MONEY_INPUT}
        />
        <p className="text-[11px] text-muted-foreground">Valor destacado na nota fiscal de venda.</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] text-muted-foreground">Frete CT-e</Label>
        <Input
          type="number"
          min={0}
          step={0.01}
          inputMode="decimal"
          value={freteSeller}
          onChange={(e) => onChange("freteSeller", e.target.value)}
          className={MONEY_INPUT}
        />
        <p className="text-[11px] text-muted-foreground">Complementa o valor do conhecimento de transporte.</p>
      </div>
    </div>
  );
}
